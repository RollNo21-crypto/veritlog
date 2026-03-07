/**
 * IMAP Email Polling Service
 * Connects to Titan Mail via IMAP, finds unread emails with PDF attachments,
 * and processes them as tax notices via AI extraction.
 *
 * Uses `mailparser` to reliably parse MIME structure — avoids manual part-path
 * navigation which hangs on forwarded/nested emails.
 */

import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { extractNoticeData } from "~/server/services/extraction";
import { uploadToS3 } from "~/server/services/storage";
import { db } from "~/server/db";
import { notices, auditLogs, tenants } from "~/server/db/schema";

export type PollResult = {
    processed: number;
    failed: number;
    skipped: number;
    lastError?: string;
};

export async function pollEmailInbox(tenantId: string): Promise<PollResult> {
    const host = process.env.EMAIL_IMAP_HOST;
    const port = Number(process.env.EMAIL_IMAP_PORT ?? "993");
    const user = process.env.EMAIL_IMAP_USER;
    const pass = process.env.EMAIL_IMAP_PASS;

    if (!host || !user || !pass) {
        console.warn("[IMAP] Missing EMAIL_IMAP_* env vars — skipping poll");
        return { processed: 0, failed: 0, skipped: 0 };
    }

    const client = new ImapFlow({
        host,
        port,
        secure: true,
        auth: { user, pass },
        logger: false,
        // Connection timeout — prevents hanging forever
        socketTimeout: 30000,
    });

    const result: PollResult = { processed: 0, failed: 0, skipped: 0 };

    try {
        await client.connect();
        const lock = await client.getMailboxLock("INBOX");

        try {
            const searchResult = await client.search({ seen: false }, { uid: true });
            const uids: number[] = Array.isArray(searchResult) ? searchResult : [];

            if (uids.length === 0) {
                console.log("[IMAP] No unread messages");
                return result;
            }

            console.log(`[IMAP] Found ${uids.length} unread message(s)`);

            for (const uid of uids) {
                try {
                    // Fetch full raw RFC822 source — reliably handles all MIME structures
                    const msg = await client.fetchOne(String(uid), { source: true, envelope: true }, { uid: true });
                    if (!msg?.source) {
                        console.log(`[IMAP] UID ${uid} — no source, skipping`);
                        result.skipped++;
                        continue;
                    }

                    const subject = msg.envelope?.subject ?? "(no subject)";
                    console.log(`[IMAP] Processing: ${subject}`);

                    // Parse with mailparser — handles nested/forwarded emails correctly
                    const parsed = await simpleParser(msg.source);
                    const pdfAttachments = (parsed.attachments ?? []).filter(
                        (a) => a.contentType === "application/pdf" || a.filename?.toLowerCase().endsWith(".pdf")
                    );

                    if (pdfAttachments.length === 0) {
                        console.log(`[IMAP] No PDFs in: ${subject} — skipping`);
                        try { await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true }); } catch { /* ignore */ }
                        result.skipped++;
                        continue;
                    }

                    for (const attachment of pdfAttachments) {
                        const filename = attachment.filename ?? `notice_${Date.now()}.pdf`;
                        const buffer = attachment.content; // Buffer from mailparser

                        try {
                            const noticeId = `notice_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                            const s3Key = `${tenantId}/${noticeId}/${filename}`;

                            console.log(`[IMAP] Uploading PDF ${filename} to S3...`);
                            const s3Result = await uploadToS3(s3Key, buffer.buffer as ArrayBuffer, "application/pdf");

                            console.log(`[IMAP] Running AI extraction on ${filename}...`);
                            const dataUrl = `data:application/pdf;base64,${buffer.toString("base64")}`;
                            const extraction = await extractNoticeData(dataUrl, "parallel");

                            // Upsert tenant (FK constraint safety)
                            await db.insert(tenants).values({
                                id: tenantId,
                                name: "CA Firm",
                                plan: "free",
                                createdAt: new Date(),
                            }).onConflictDoNothing();

                            const amountPaise = extraction.data.amount ? extraction.data.amount * 100 : null;
                            const riskLevel = calcRisk(extraction.data.deadline, amountPaise);
                            const status = extraction.confidence === "low" ? "review_needed" : "processing";

                            console.log(`[IMAP] Inserting notice into DB (confidence: ${extraction.confidence})...`);
                            await db.insert(notices).values({
                                id: noticeId,
                                tenantId,
                                status,
                                fileName: filename,
                                fileUrl: s3Result.fileUrl,
                                fileHash: s3Result.fileHash,
                                noticeType: extraction.data.noticeType ?? null,
                                authority: extraction.data.authority ?? null,
                                section: extraction.data.section ?? null,
                                financialYear: extraction.data.financialYear ?? null,
                                amount: amountPaise,
                                deadline: extraction.data.deadline ?? null,
                                summary: extraction.data.summary ?? null,
                                confidence: extraction.confidence,
                                riskLevel,
                                source: "email",
                                createdAt: new Date(),
                                updatedAt: new Date(),
                            });

                            const auditId = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                            await db.insert(auditLogs).values({
                                id: auditId,
                                tenantId,
                                userId: "system",
                                action: "notice.created_via_email",
                                entityType: "notice",
                                entityId: noticeId,
                                newValue: JSON.stringify({ source: "email", subject, filename }),
                                createdAt: new Date(),
                            });

                            console.log(`[IMAP] ✅ Created notice ${noticeId} (${extraction.confidence} confidence)`);
                            result.processed++;
                        } catch (pdfErr) {
                            const errMsg = pdfErr instanceof Error ? pdfErr.message : String(pdfErr);
                            console.error(`[IMAP] ❌ Failed processing PDF ${filename}:`, errMsg);
                            result.failed++;
                            result.lastError = errMsg;
                        }
                    }

                    // Mark as read after processing all attachments
                    try { await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true }); } catch { /* ignore */ }
                } catch (msgErr) {
                    const errMsg = msgErr instanceof Error ? msgErr.message : String(msgErr);
                    console.error("[IMAP] ❌ Message error:", errMsg);
                    result.failed++;
                    result.lastError = errMsg;
                }
            }
        } finally {
            lock.release();
        }
    } finally {
        try { await client.logout(); } catch { /* ignore */ }
    }

    return result;
}

function calcRisk(deadline?: string | null, amountPaise?: number | null): "high" | "medium" | "low" {
    const days = deadline
        ? Math.ceil((new Date(deadline).getTime() - Date.now()) / 86_400_000)
        : null;
    if ((days !== null && days < 7) || (amountPaise !== null && amountPaise !== undefined && amountPaise > 100_000_00)) return "high";
    if ((days !== null && days < 14) || (amountPaise !== null && amountPaise !== undefined && amountPaise > 10_000_00)) return "medium";
    return "low";
}
