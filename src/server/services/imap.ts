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
import { notices, auditLogs, tenants, clients } from "~/server/db/schema";
import { eq, and, or, ilike } from "drizzle-orm";

export type PollResult = {
    processed: number;
    failed: number;
    skipped: number;
    lastError?: string;
};

export async function pollEmailInbox(
    tenantId: string,
    mode: "parallel" | "mock" = "parallel",
    deadlineMs?: number // optional hard cutoff timestamp (ms since epoch) to avoid Vercel timeouts
): Promise<PollResult> {
    const host = process.env.EMAIL_IMAP_HOST;
    const port = Number(process.env.EMAIL_IMAP_PORT ?? "993");
    const user = process.env.EMAIL_IMAP_USER;
    const pass = process.env.EMAIL_IMAP_PASS;

    if (!host || !user || !pass) {
        console.warn("⚠️ [IMAP] Missing EMAIL_IMAP_* env vars — skipping poll. Check your .env file.");
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
                console.log("📭 [IMAP] Inbox is clear. No unread messages found.");
                return result;
            }

            console.log(`📬 [IMAP] Found ${uids.length} unread message(s). Starting processing cycle...`);

            for (const uid of uids) {
                // ⏱️ Time-budget check: stop if within 20s of deadline to ensure clean exit
                if (deadlineMs && Date.now() > deadlineMs - 20_000) {
                    console.warn(`⏱️ [IMAP] Time budget exhausted. Stopping after ${result.processed} processed. ${uids.length - uids.indexOf(uid)} email(s) will retry next cycle.`);
                    break;
                }
                try {
                    // Fetch full raw RFC822 source — reliably handles all MIME structures
                    const msg = await client.fetchOne(String(uid), { source: true, envelope: true }, { uid: true });
                    if (!msg || typeof msg === "boolean" || !msg.source) {
                        console.log(`⏭️ [IMAP] UID: ${uid} | No source found in email, skipping...`);
                        result.skipped++;
                        continue;
                    }

                    const subject = msg.envelope?.subject ?? "(no subject)";
                    console.log(`\n📧 [IMAP] Processing Email: "${subject}"`);

                    // Parse with mailparser — handles nested/forwarded emails correctly
                    const parsed = await simpleParser(msg.source as Buffer);
                    const noticeAttachments = (parsed.attachments ?? []).filter(
                        (a) => a.contentType === "application/pdf" ||
                            a.contentType.startsWith("image/") ||
                            a.filename?.toLowerCase().endsWith(".pdf") ||
                            a.filename?.toLowerCase().match(/\.(jpg|jpeg|png)$/i)
                    );

                    console.log(`📎 [IMAP] Found ${noticeAttachments.length} valid attachment(s) (PDF/Image) out of ${parsed.attachments?.length ?? 0} total.`);

                    if (noticeAttachments.length === 0) {
                        // 📧 Handle Email Intimations (No Attachments)
                        console.log(`🔍 [IMAP] No attachments — checking body for intimation...`);
                        const bodyText = (parsed.text || (typeof parsed.html === 'string' ? parsed.html.replace(/<[^>]*>?/gm, "") : "")).trim();
                        if (bodyText.length < 50) {
                            console.log(`⏭️ [IMAP] Skip: Body too short (${bodyText.length} chars) for: "${subject}"`);
                            try { await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true }); } catch { /* ignore */ }
                            result.skipped++;
                            continue;
                        }

                        try {
                            const noticeId = `notice_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                            console.log(`🎯 [IMAP/Intimation] Saving email body as intimation: "${subject}"`);

                            if (tenantId === "system") {
                                console.warn("⚠️ [IMAP] Using 'system' tenant ID for intimation. Check EMAIL_TENANT_ID in .env");
                            }

                            // Upload the text as an S3 object to preserve it for AI
                            const s3Key = `${tenantId}/${noticeId}/Email_Body.txt`;
                            const encoder = new TextEncoder();
                            const textBuffer = encoder.encode(bodyText);
                            const arrayBuffer = textBuffer.buffer.slice(textBuffer.byteOffset, textBuffer.byteOffset + textBuffer.byteLength) as ArrayBuffer;
                            const s3Result = await uploadToS3(s3Key, arrayBuffer, "text/plain");

                            // Upsert tenant
                            await db.insert(tenants).values({
                                id: tenantId,
                                name: "CA Firm",
                                plan: "free",
                                createdAt: new Date(),
                            }).onConflictDoNothing({ target: tenants.id });
                            console.log(`✅ [IMAP] Tenant record verified (Intimation): ${tenantId}`);

                            await db.insert(notices).values({
                                id: noticeId,
                                tenantId,
                                clientId: null,
                                status: "processing",
                                fileName: "Email Intimation.txt",
                                fileUrl: s3Result.fileUrl,
                                fileHash: s3Result.fileHash, // This will ensure we have the uploaded file hash
                                noticeType: "Pending Extraction",
                                authority: "Pending Extraction",
                                section: null,
                                financialYear: null,
                                amount: null,
                                deadline: null,
                                summary: "This email was received via IMAP. Pending AI summarization.",
                                confidence: null,
                                riskLevel: null,
                                isTranslated: false,
                                originalLanguage: null,
                                source: "email",
                                createdAt: new Date(),
                                updatedAt: new Date(),
                            });

                            console.log(`💾 [IMAP/DB] Successfully inserted intimation notice: ${noticeId}`);

                            // 🔔 Create audit log entry for notification bell
                            const auditId = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                            await db.insert(auditLogs).values({
                                id: auditId,
                                tenantId,
                                userId: "system",
                                action: "notice.created_via_email",
                                entityType: "notice",
                                entityId: noticeId,
                                newValue: JSON.stringify({ source: "imap", type: "intimation", fileName: "Email Intimation.txt" }),
                                createdAt: new Date(),
                            });

                            result.processed++;
                            console.log(`✅  [IMAP] Intimation created: ${noticeId}`);
                            // ✅ Mark as Seen only after successful DB insertion
                            try { await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true }); } catch { /* ignore */ }
                        } catch (err) {
                            console.error(`❌ [IMAP] Error analyzing body: ${err}`);
                            result.failed++;
                            // DO NOT mark as Seen — allow retry on next poll cycle
                        }
                    } else {
                        // 📎 Handle PDF / Image Attachments (Existing Logic)
                        for (const attachment of noticeAttachments) {
                            const filename = attachment.filename ?? `notice_${Date.now()}`;
                            const buffer = attachment.content;
                            const contentType = attachment.contentType || "application/octet-stream";

                            try {
                                const noticeId = `notice_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                                const s3Key = `${tenantId}/${noticeId}/${filename}`;

                                console.log(`☁️  [IMAP/S3] Uploading attachment '${filename}' (${contentType}) to S3 storage...`);
                                const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
                                const s3Result = await uploadToS3(s3Key, arrayBuffer, contentType);

                                console.log(`⏩ [IMAP] Skipping AI extraction to save time. Setting as Pending Extraction.`);

                                if (tenantId === "system") {
                                    console.warn("⚠️ [IMAP] Using 'system' tenant ID. Notices may be invisible to specific CAs. Check EMAIL_TENANT_ID in .env");
                                }

                                await db.insert(tenants).values({
                                    id: tenantId,
                                    name: "CA Firm",
                                    plan: "free",
                                    createdAt: new Date(),
                                }).onConflictDoNothing({ target: tenants.id });
                                console.log(`✅ [IMAP] Tenant record verified (PDF): ${tenantId}`);

                                await db.insert(notices).values({
                                    id: noticeId,
                                    tenantId,
                                    clientId: null,
                                    status: "processing",
                                    fileName: filename,
                                    fileUrl: s3Result.fileUrl,
                                    fileHash: s3Result.fileHash,
                                    noticeType: "Pending Extraction",
                                    authority: "Pending Extraction",
                                    section: null,
                                    financialYear: null,
                                    amount: null,
                                    deadline: null,
                                    summary: "Pending AI summarization.",
                                    confidence: null,
                                    riskLevel: null,
                                    isTranslated: false,
                                    originalLanguage: null,
                                    source: "email",
                                    createdAt: new Date(),
                                    updatedAt: new Date(),
                                });

                                // 🔔 Create audit log entry for notification bell
                                const auditId = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                                await db.insert(auditLogs).values({
                                    id: auditId,
                                    tenantId,
                                    userId: "system",
                                    action: "notice.created_via_email",
                                    entityType: "notice",
                                    entityId: noticeId,
                                    newValue: JSON.stringify({ source: "imap", type: "pdf", fileName: filename }),
                                    createdAt: new Date(),
                                });

                                result.processed++;
                                console.log(`✅  [IMAP] PDF notice created: ${noticeId}`);
                            } catch (pdfErr) {
                                console.error(`❌  [IMAP] ERROR: Failed processing PDF ${filename}:`, pdfErr);
                                result.failed++;
                                // DO NOT mark as Seen if this PDF failed — allow retry on next poll cycle
                            }
                        }

                        // Mark as Seen only if no failures occurred during attachment processing
                        if (result.failed === 0) {
                            try { await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true }); } catch { /* ignore */ }
                        }
                    } // end else (PDF/Image branch)
                } catch (msgErr) {
                    const errMsg = msgErr instanceof Error ? msgErr.message : String(msgErr);
                    console.error("🚨  [IMAP] CRITICAL: Message processing error:", errMsg);
                    result.failed++;
                    result.lastError = errMsg;
                }
            } // end for (uid of uids)
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
