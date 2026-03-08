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
    mode: "parallel" | "mock" = "parallel"
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
                            console.log(`🤖  [IMAP/AI] Analyzing email body for intimation: "${subject}"`);
                            const extraction = await extractNoticeData(null, mode, bodyText);

                            if (extraction.data.isIntimation || extraction.data.extractedGstin || extraction.data.extractedPan) {
                                const noticeId = `notice_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                                console.log(`🎯 [IMAP/Intimation] AI confirmed notice-related content.`);

                                if (tenantId === "system") {
                                    console.warn("⚠️ [IMAP] Using 'system' tenant ID for intimation. Check EMAIL_TENANT_ID in .env");
                                }

                                // 🔍 Try to find a matching client (Hierarchical: ID > Name)
                                let matchedClientId: string | null = null;
                                const extractionData = extraction.data;

                                const conditions = [];
                                if (extractionData.extractedGstin) conditions.push(eq(clients.gstin, extractionData.extractedGstin));
                                if (extractionData.extractedPan) conditions.push(eq(clients.pan, extractionData.extractedPan));

                                // Add fuzzy name matches as fallback
                                if (extractionData.extractedBusinessName) conditions.push(ilike(clients.businessName, `%${extractionData.extractedBusinessName}%`));
                                if (extractionData.extractedContactName) conditions.push(ilike(clients.contactName, `%${extractionData.extractedContactName}%`));

                                if (conditions.length > 0) {
                                    const matchedClients = await db.select().from(clients).where(
                                        and(eq(clients.tenantId, tenantId), or(...conditions))
                                    ).limit(1);

                                    if (matchedClients[0]) {
                                        console.log(`🎯 [IMAP/Client] Found matching client: ${matchedClients[0].businessName}`);
                                        matchedClientId = matchedClients[0].id;
                                    }
                                }

                                // Upsert tenant
                                await db.insert(tenants).values({
                                    id: tenantId,
                                    name: "CA Firm",
                                    plan: "free",
                                    createdAt: new Date(),
                                }).onConflictDoNothing({ target: tenants.id });
                                console.log(`✅ [IMAP] Tenant record verified (Intimation): ${tenantId}`);

                                const amountPaise = extraction.data.amount ? Math.round(extraction.data.amount * 100) : null;
                                const riskLevel = calcRisk(extraction.data.deadline, amountPaise);

                                await db.insert(notices).values({
                                    id: noticeId,
                                    tenantId,
                                    clientId: matchedClientId,
                                    status: "review_needed",
                                    fileName: "Email Intimation (Manual Download Required)",
                                    fileUrl: "#", // Placeholder
                                    fileHash: "intimation",
                                    noticeType: extraction.data.noticeType ?? "Portal Notification",
                                    authority: extraction.data.authority ?? "GST Portal",
                                    section: extraction.data.section ?? null,
                                    financialYear: extraction.data.financialYear ?? null,
                                    amount: amountPaise,
                                    deadline: extraction.data.deadline ?? null,
                                    summary: extraction.data.summary ?? "This notice was notified via email. Please log in to the portal to download the full document.",
                                    confidence: extraction.confidence,
                                    riskLevel,
                                    isTranslated: extraction.data.isTranslated,
                                    originalLanguage: extraction.data.originalLanguage,
                                    source: "email", // Keeping as email for dashboard filtering
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
                                    newValue: JSON.stringify({ source: "imap", type: "intimation", fileName: "Email Intimation" }),
                                    createdAt: new Date(),
                                });

                                result.processed++;
                                console.log(`✅  [IMAP] Intimation created: ${noticeId}`);
                            } else {
                                console.log(`⏭️ [IMAP] Skip: Not a notice-related email.`);
                                result.skipped++;
                            }
                        } catch (err) {
                            console.error(`❌ [IMAP] Error analyzing body: ${err}`);
                            result.failed++;
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

                                console.log(`🤖  [IMAP/AI] Running AI extraction (${mode}) on '${filename}'...`);
                                const bodyText = (parsed.text || (typeof parsed.html === 'string' ? parsed.html.replace(/<[^>]*>?/gm, "") : "")).trim();
                                const dataUrl = `data:${contentType};base64,${buffer.toString("base64")}`;
                                const extraction = await extractNoticeData(dataUrl, mode, bodyText);

                                if (tenantId === "system") {
                                    console.warn("⚠️ [IMAP] Using 'system' tenant ID. Notices may be invisible to specific CAs. Check EMAIL_TENANT_ID in .env");
                                }

                                // 🔍 Try to find a matching client (Hierarchical: ID > Name)
                                let matchedClientId: string | null = null;
                                const extractionData = extraction.data;

                                const clientConditions = [];
                                if (extractionData.extractedGstin) clientConditions.push(eq(clients.gstin, extractionData.extractedGstin));
                                if (extractionData.extractedPan) clientConditions.push(eq(clients.pan, extractionData.extractedPan));

                                // Add fuzzy name matches as fallback
                                if (extractionData.extractedBusinessName) clientConditions.push(ilike(clients.businessName, `%${extractionData.extractedBusinessName}%`));
                                if (extractionData.extractedContactName) clientConditions.push(ilike(clients.contactName, `%${extractionData.extractedContactName}%`));

                                if (clientConditions.length > 0) {
                                    const matchedClients = await db.select().from(clients).where(
                                        and(eq(clients.tenantId, tenantId), or(...clientConditions))
                                    ).limit(1);

                                    if (matchedClients[0]) {
                                        console.log(`🎯 [IMAP/Client] Found matching client: ${matchedClients[0].businessName}`);
                                        matchedClientId = matchedClients[0].id;
                                    }
                                }

                                await db.insert(tenants).values({
                                    id: tenantId,
                                    name: "CA Firm",
                                    plan: "free",
                                    createdAt: new Date(),
                                }).onConflictDoNothing({ target: tenants.id });
                                console.log(`✅ [IMAP] Tenant record verified (PDF): ${tenantId}`);

                                const amountPaise = extraction.data.amount ? Math.round(extraction.data.amount * 100) : null;
                                const riskLevel = calcRisk(extraction.data.deadline, amountPaise);
                                const status = extraction.confidence === "low" ? "review_needed" : "processing";

                                await db.insert(notices).values({
                                    id: noticeId,
                                    tenantId,
                                    clientId: matchedClientId,
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
                                    isTranslated: extraction.data.isTranslated,
                                    originalLanguage: extraction.data.originalLanguage,
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
                            } catch (pdfErr) {
                                console.error(`❌  [IMAP] ERROR: Failed processing PDF ${filename}:`, pdfErr);
                                result.failed++;
                            }
                        }
                    }

                    // Mark as read after processing all attachments
                    try { await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true }); } catch { /* ignore */ }
                } catch (msgErr) {
                    const errMsg = msgErr instanceof Error ? msgErr.message : String(msgErr);
                    console.error("🚨  [IMAP] CRITICAL: Message processing error:", errMsg);
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
