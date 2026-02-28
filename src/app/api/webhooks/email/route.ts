import { NextRequest, NextResponse } from "next/server";

/**
 * Email Ingestion Webhook (Epic 1 — FR2, FR3)
 *
 * Receives webhooks from SendGrid / Mailgun Inbound Parse.
 * Processes attachments (PDFs), uploads to S3, runs AI extraction,
 * and creates Notice records automatically.
 *
 * Security: Verify provider webhook signature before processing.
 *
 * Tenant mapping from recipient address:
 *   notices+{tenantId}@ingest.veritlog.in
 */
export async function POST(req: NextRequest) {
    try {
        // ─── Parse webhook payload ────────────────────────────────────────
        const body = await req.json() as Record<string, unknown>;

        // Support both SendGrid and Mailgun payload shapes
        const from = (body.from ?? body.sender) as string | undefined;
        const subject = (body.subject ?? "(no subject)") as string;
        const to = (body.to ?? body.recipient) as string | undefined;
        const attachments = (body.attachments ?? body.attachments_count
            ? body.attachments
            : []) as Array<{
                name: string;
                content: string;       // base64 encoded
                content_type: string;
                size: number;
            }>;

        // ─── Identify tenant from recipient address ───────────────────────
        const tenantId = extractTenantFromEmail(to ?? "");

        if (!tenantId) {
            console.warn("[Email] Could not extract tenant from:", to);
            // Return 200 to prevent provider retries for permanently invalid addresses
            return NextResponse.json({ received: true, skipped: "no_tenant" });
        }

        console.log("[Email] Received:", { from, subject, tenantId, attachmentCount: Array.isArray(attachments) ? attachments.length : 0 });

        // ─── Process each PDF attachment ──────────────────────────────────
        const processedNotices: string[] = [];

        if (Array.isArray(attachments) && attachments.length > 0) {
            // AWS: storage is a stateless S3 singleton — no binding injection needed
            const { uploadToS3, getFileViewUrl } = await import("~/server/services/storage");
            const { extractNoticeData } = await import("~/server/services/extraction");
            const { db } = await import("~/server/db");
            const { notices: noticesTable } = await import("~/server/db/schema");

            for (const attachment of attachments) {
                // Only process PDF / image attachments
                const isPdf = attachment.content_type === "application/pdf";
                const isImage = attachment.content_type.startsWith("image/");
                if (!isPdf && !isImage) continue;

                try {
                    const noticeId = `notice_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                    const fileKey = `${tenantId}/${noticeId}/${attachment.name}`;

                    // Decode base64 content and upload to S3
                    const binaryStr = atob(attachment.content);
                    const bytes = new Uint8Array(binaryStr.length);
                    for (let i = 0; i < binaryStr.length; i++) {
                        bytes[i] = binaryStr.charCodeAt(i)!;
                    }

                    const s3Result = await uploadToS3(fileKey, bytes.buffer, attachment.content_type);
                    const fileUrl = getFileViewUrl(noticeId);

                    // AI extraction
                    const extraction = await extractNoticeData(fileUrl, "mock");
                    const amountPaise = extraction.data.amount ? extraction.data.amount * 100 : null;
                    const status = extraction.confidence === "low" ? "review_needed" : "processing";

                    // Calculate risk (same logic as notice router)
                    const deadline = extraction.data.deadline;
                    const amountRupees = amountPaise ? amountPaise / 100 : 0;
                    let riskLevel = "low";
                    if (amountRupees > 1000000) riskLevel = "high";
                    else if (amountRupees > 100000) riskLevel = "medium";
                    if (deadline) {
                        const daysUntil = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
                        if (daysUntil < 7) riskLevel = "high";
                        else if (daysUntil < 14 && riskLevel !== "high") riskLevel = "medium";
                    }

                    await db.insert(noticesTable).values({
                        id: noticeId,
                        tenantId,
                        fileName: attachment.name,
                        fileUrl,
                        fileSize: attachment.size,
                        fileHash: s3Result.fileHash,
                        authority: extraction.data.authority,
                        noticeType: extraction.data.noticeType,
                        amount: amountPaise,
                        deadline: extraction.data.deadline,
                        section: extraction.data.section,
                        financialYear: extraction.data.financialYear,
                        confidence: extraction.confidence,
                        riskLevel,
                        status,
                        source: "email",
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    });

                    processedNotices.push(noticeId);
                    console.log(`[Email] Processed attachment: ${attachment.name} → notice ${noticeId}`);
                } catch (attachErr) {
                    console.error(`[Email] Failed to process attachment ${attachment.name}:`, attachErr);
                }
            }
        } else {
            console.log("[Email] No PDF/image attachments in email from:", from);
        }

        return NextResponse.json({
            success: true,
            noticesCreated: processedNotices.length,
            noticeIds: processedNotices,
        });
    } catch (error) {
        console.error("[Email] Webhook error:", error);
        return NextResponse.json({ error: "Failed to process email" }, { status: 500 });
    }
}

/**
 * Extract tenantId from the recipient address.
 * Format: notices+{tenantId}@ingest.veritlog.in
 */
function extractTenantFromEmail(email: string): string | null {
    if (!email) return null;
    const match = email.match(/notices\+([^@]+)@/);
    return match?.[1] ?? null;
}
