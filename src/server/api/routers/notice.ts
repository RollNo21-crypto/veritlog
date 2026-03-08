import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { extractNoticeData, translateNoticeDocument, generateDraftResponse } from "~/server/services/extraction";
import { uploadToS3, dataUrlToBuffer, getFileViewUrl, getPresignedUrl, getFileObject } from "~/server/services/storage";
import { alertHighRisk } from "~/server/services/whatsapp";
import { generateShareToken } from "~/server/services/shareToken";
import { notices, auditLogs, attachments, clients } from "~/server/db/schema";
import { eq, and, isNull, desc, asc, sql, getTableColumns, or, ilike } from "drizzle-orm";

/**
 * Calculate risk level based on deadline proximity and amount.
 * High: Deadline < 7 days OR Amount > ₹10 Lakhs
 * Medium: Deadline < 14 days OR Amount > ₹1 Lakh
 * Low: Otherwise
 */
function calculateRiskLevel(deadline: string | null, amountPaise: number | null): "high" | "medium" | "low" {
    const amountRupees = amountPaise ? amountPaise / 100 : 0;

    // Check amount thresholds
    if (amountRupees > 1000000) return "high"; // > ₹10 Lakhs
    if (amountRupees > 100000) {
        // > ₹1 Lakh — at least medium, check deadline
    }

    // Check deadline proximity
    if (deadline) {
        const deadlineDate = new Date(deadline);
        const now = new Date();
        const daysUntil = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        if (daysUntil < 7) return "high";
        if (daysUntil < 14) return "medium";
    }

    if (amountRupees > 100000) return "medium";
    return "low";
}

export const noticeRouter = createTRPCRouter({
    /**
     * Upload and process a notice document
     */
    upload: protectedProcedure
        .input(
            z.object({
                fileName: z.string(),
                fileSize: z.number(),
                fileType: z.string(),
                fileData: z.string(), // base64 data URL or existing R2 key
                clientId: z.string().optional(),
                replaceNoticeId: z.string().optional(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const tenantId = ctx.session.userId;
            if (!tenantId) {
                throw new Error("No organization or user selected");
            }

            const noticeId = input.replaceNoticeId ?? `notice_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            const fileKey = `${tenantId}/${noticeId}/${input.fileName}`;

            // Upload file to S3 (private bucket, accessed via presigned URL or proxy)
            let fileUrl: string;
            let fileHash: string = "";
            if (input.fileData.startsWith("data:")) {
                const { buffer, contentType } = dataUrlToBuffer(input.fileData);
                const s3Result = await uploadToS3(fileKey, buffer, contentType);
                fileUrl = getFileViewUrl(fileKey); // Use proxy route for secure access
                fileHash = s3Result.fileHash;
            } else {
                // Already a URL (e.g., email attachment previously uploaded)
                fileUrl = input.fileData;
            }

            // Run AI extraction (uses file URL or base64 content)
            const extraction = await extractNoticeData(fileUrl, "parallel");
            const amountPaise = extraction.data.amount ? extraction.data.amount * 100 : null;
            const riskLevel = calculateRiskLevel(extraction.data.deadline, amountPaise);
            const status = extraction.confidence === "low" ? "review_needed" : "processing";

            // Entity Mismatch Detection
            let mismatchWarning: string | null = null;
            if (input.clientId) {
                const clientRecord = await ctx.db
                    .select({ pan: clients.pan, gstin: clients.gstin })
                    .from(clients)
                    .where(eq(clients.id, input.clientId))
                    .limit(1);

                if (clientRecord[0]) {
                    const { pan, gstin } = clientRecord[0];
                    const { extractedPan, extractedGstin } = extraction.data;

                    const warnings = [];
                    if (pan && extractedPan && pan.trim().toUpperCase() !== extractedPan.trim().toUpperCase()) {
                        warnings.push(`PAN mismatch (Expected: ${pan}, Found: ${extractedPan})`);
                    }
                    if (gstin && extractedGstin && gstin.trim().toUpperCase() !== extractedGstin.trim().toUpperCase()) {
                        warnings.push(`GSTIN mismatch (Expected: ${gstin}, Found: ${extractedGstin})`);
                    }

                    if (warnings.length > 0) {
                        mismatchWarning = warnings.join(" | ");
                    }
                }
            }

            // Ghost Notice Detector
            let isDuplicate = false;
            if (extraction.data.authority && amountPaise !== null && extraction.data.deadline) {
                const existing = await ctx.db
                    .select({ id: notices.id })
                    .from(notices)
                    .where(
                        and(
                            eq(notices.tenantId, tenantId),
                            eq(notices.authority, extraction.data.authority),
                            eq(notices.amount, amountPaise),
                            eq(notices.deadline, extraction.data.deadline),
                            isNull(notices.deletedAt)
                        )
                    )
                    .limit(1);

                if (existing.length > 0) {
                    isDuplicate = true;
                }
            }

            const noticeValues = {
                id: noticeId,
                tenantId,
                clientId: input.clientId ?? null,
                fileName: input.fileName,
                fileUrl,
                fileSize: input.fileSize,
                fileHash: fileHash || null,
                authority: extraction.data.authority,
                noticeType: extraction.data.noticeType,
                amount: amountPaise,
                deadline: extraction.data.deadline,
                section: extraction.data.section,
                financialYear: extraction.data.financialYear,
                summary: extraction.data.summary,
                nextSteps: extraction.data.nextSteps,
                requiredDocuments: extraction.data.requiredDocuments,
                confidence: extraction.confidence,
                riskLevel,
                status,
                mismatchWarning,
                isDuplicate,
                isTranslated: extraction.data.isTranslated,
                originalLanguage: extraction.data.originalLanguage,
                source: "upload",
                updatedAt: new Date(),
            };

            if (input.replaceNoticeId) {
                await ctx.db.update(notices)
                    .set(noticeValues)
                    .where(and(eq(notices.id, input.replaceNoticeId), eq(notices.tenantId, tenantId)));
            } else {
                await ctx.db.insert(notices).values({
                    ...noticeValues,
                    createdAt: new Date(),
                });
            }

            // 🔔 Fire WhatsApp high-risk alert (non-blocking, best-effort)
            if (riskLevel === "high" && !isDuplicate) {
                const shareToken = generateShareToken(noticeId, tenantId);
                void alertHighRisk({
                    noticeId,
                    noticeType: extraction.data.noticeType,
                    authority: extraction.data.authority,
                    deadline: extraction.data.deadline,
                    amount: amountPaise,
                    deepLinkToken: shareToken,
                });
            }

            return {
                noticeId,
                extraction: extraction.data,
                confidence: extraction.confidence,
                riskLevel,
                status,
                processingTime: extraction.processingTime,
            };
        }),

    /**
     * List notices for current tenant (excludes soft-deleted)
     */
    list: protectedProcedure
        .input(
            z
                .object({
                    status: z
                        .enum(["processing", "review_needed", "verified", "in_progress", "closed"])
                        .optional(),
                    clientId: z.string().optional(),
                    authority: z.string().optional(),
                    riskLevel: z.enum(["high", "medium", "low"]).optional(),
                    sortBy: z.enum(["createdAt", "riskLevel"]).default("createdAt"),
                })
                .optional()
        )
        .query(async ({ ctx, input }) => {
            const tenantId = ctx.session.userId;
            if (!tenantId) {
                return [];
            }

            const conditions = [
                eq(notices.tenantId, tenantId),
                isNull(notices.deletedAt), // Exclude soft-deleted
            ];
            if (input?.status) {
                conditions.push(eq(notices.status, input.status));
            }
            if (input?.clientId) {
                conditions.push(eq(notices.clientId, input.clientId));
            }
            if (input?.authority) {
                conditions.push(eq(notices.authority, input.authority));
            }
            if (input?.riskLevel) {
                conditions.push(eq(notices.riskLevel, input.riskLevel));
            }

            let orderByClause;
            if (input?.sortBy === "riskLevel") {
                // Map risk levels to numbers for proper sorting (high=1, medium=2, low=3)
                // then sort chronologically by deadline within those tiers
                orderByClause = [
                    sql`CASE 
                        WHEN ${notices.riskLevel} = 'high' THEN 1
                        WHEN ${notices.riskLevel} = 'medium' THEN 2
                        WHEN ${notices.riskLevel} = 'low' THEN 3
                        ELSE 4 
                    END`,
                    asc(notices.deadline),
                    desc(notices.createdAt)
                ];
            } else {
                orderByClause = [desc(notices.createdAt)];
            }

            return await ctx.db
                .select({
                    ...getTableColumns(notices),
                    clientBusinessName: clients.businessName,
                })
                .from(notices)
                .leftJoin(clients, eq(notices.clientId, clients.id))
                .where(and(...conditions))
                .orderBy(...orderByClause);
        }),

    /**
     * Get single notice by ID (with tenant isolation)
     */
    getById: protectedProcedure
        .input(z.object({ id: z.string() }))
        .query(async ({ ctx, input }) => {
            const tenantId = ctx.session.userId;
            if (!tenantId) {
                throw new Error("No organization or user selected");
            }

            const result = await ctx.db
                .select()
                .from(notices)
                .where(
                    and(
                        eq(notices.id, input.id),
                        eq(notices.tenantId, tenantId),
                        isNull(notices.deletedAt)
                    )
                )
                .limit(1);

            return result[0] ?? null;
        }),

    /**
     * Update notice fields (recalculates risk on change)
     */
    update: protectedProcedure
        .input(
            z.object({
                id: z.string(),
                authority: z.string().optional(),
                noticeType: z.string().optional(),
                amount: z.number().nullable().optional(),
                deadline: z.string().optional(),
                section: z.string().optional(),
                financialYear: z.string().optional(),
                clientId: z.string().nullable().optional(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const tenantId = ctx.session.userId;
            if (!tenantId) {
                throw new Error("No organization or user selected");
            }

            const { id, ...updates } = input;

            // Recalculate risk if deadline or amount changed
            let riskLevel: string | undefined;
            if (updates.deadline !== undefined || updates.amount !== undefined) {
                const current = await ctx.db
                    .select()
                    .from(notices)
                    .where(eq(notices.id, id))
                    .limit(1);

                if (current[0]) {
                    const amountPaise = updates.amount !== undefined ? updates.amount : current[0].amount;
                    const deadline = updates.deadline !== undefined ? updates.deadline : current[0].deadline;
                    riskLevel = calculateRiskLevel(deadline, amountPaise);
                }
            }

            await ctx.db
                .update(notices)
                .set({
                    ...updates,
                    ...(riskLevel ? { riskLevel } : {}),
                    updatedAt: new Date(),
                })
                .where(and(eq(notices.id, id), eq(notices.tenantId, tenantId)));

            return { success: true };
        }),

    /**
     * Translates a notice document to English using AI
     */
    translate: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ ctx, input }) => {
            const tenantId = ctx.session.userId;
            if (!tenantId) {
                throw new Error("No organization or user selected");
            }

            // Get notice details
            const notice = await ctx.db
                .select()
                .from(notices)
                .where(
                    and(
                        eq(notices.id, input.id),
                        eq(notices.tenantId, tenantId),
                        isNull(notices.deletedAt)
                    )
                )
                .limit(1);

            if (!notice[0] || !notice[0].fileUrl) {
                throw new Error("Notice or document not found.");
            }

            const noticeRecord = notice[0];
            const fileUrl = noticeRecord.fileUrl!;
            const fileName = noticeRecord.fileName ?? "document.pdf";

            // The fileUrl is a proxy URL like /api/files/notice_xxx
            // We need to fetch the actual file bytes to send to Gemini
            let fileBase64: string;
            let mimeType: string;

            const ext = fileName.split('.').pop()?.toLowerCase();
            mimeType = ext === 'pdf' ? 'application/pdf'
                : ext === 'png' ? 'image/png'
                    : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
                        : 'application/pdf';

            // Reconstruct the S3 key exactly as it was stored on upload
            // Upload pattern: `${tenantId}/${noticeId}/${input.fileName}` (no encoding)
            const s3Key = `${tenantId}/${noticeRecord.id}/${fileName}`;
            try {
                const presignedUrl = await getPresignedUrl(s3Key, 300);
                const fileRes = await fetch(presignedUrl);
                if (!fileRes.ok) throw new Error(`Failed to fetch file: ${fileRes.status}`);
                const arrayBuffer = await fileRes.arrayBuffer();
                fileBase64 = Buffer.from(arrayBuffer).toString("base64");
            } catch (fetchErr) {
                console.error("[Translate] Could not fetch file from S3:", fetchErr);
                throw new Error("Could not access the notice document for translation.");
            }

            const dataUrl = `data:${mimeType};base64,${fileBase64}`;
            const translation = await translateNoticeDocument(dataUrl);
            return { translation };
        }),

    /**
     * Generate Draft Response (Epic 7)
     */
    generateDraftReply: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ ctx, input }) => {
            const tenantId = ctx.session.userId;
            if (!tenantId) throw new Error("No organization or user selected");

            const notice = await ctx.db
                .select()
                .from(notices)
                .where(and(eq(notices.id, input.id), eq(notices.tenantId, tenantId)))
                .limit(1)
                .then((res) => res[0]);

            if (!notice) throw new Error("Notice not found");

            // Format data for the prompt
            const noticeData = {
                type: notice.noticeType ?? "Tax Notice",
                authority: notice.authority ?? "Tax Department",
                amount: notice.amount ? `₹${(notice.amount / 100).toLocaleString("en-IN")}` : "Not specified",
                deadline: notice.deadline ?? "Not specified",
                gstin: notice.clientId ?? "Not available", // Fallback to clientId since gstin is in the clients table
                summary: notice.summary ?? ""
            };

            // Fetch the actual document from S3 so the AI can read the raw bytes
            let documentDataUrl = "#";
            if (notice.fileUrl && notice.fileUrl !== "#") {
                try {
                    const fileName = notice.fileName ?? "document.pdf";
                    const ext = fileName.split('.').pop()?.toLowerCase();
                    const mimeType = ext === 'pdf' ? 'application/pdf'
                        : ext === 'png' ? 'image/png'
                            : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
                                : 'application/pdf';

                    // Reconstruct S3 key
                    const s3Key = `${tenantId}/${notice.id}/${fileName}`;
                    const { getPresignedUrl } = await import("~/server/services/storage");
                    const presignedUrl = await getPresignedUrl(s3Key, 300);
                    const fileRes = await fetch(presignedUrl);
                    if (fileRes.ok) {
                        const arrayBuffer = await fileRes.arrayBuffer();
                        const fileBase64 = Buffer.from(arrayBuffer).toString("base64");
                        documentDataUrl = `data:${mimeType};base64,${fileBase64}`;
                    }
                } catch (err) {
                    console.error("[generateDraftReply] Failed to fetch document from S3:", err);
                    // Fallback to text-only if file fails to load
                }
            }

            const { actionPlan, draftLetter } = await generateDraftResponse(documentDataUrl, noticeData);
            return { actionPlan, draftLetter };
        }),

    /**
     * Summarize a pending notice using AI
     */
    summarizeWithAI: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ ctx, input }) => {
            const tenantId = ctx.session.userId;
            const userId = ctx.session.userId;

            if (!tenantId) {
                throw new Error("No organization or user selected");
            }

            const notice = await ctx.db
                .select()
                .from(notices)
                .where(and(eq(notices.id, input.id), eq(notices.tenantId, tenantId)))
                .limit(1)
                .then((res) => res[0]);

            if (!notice) throw new Error("Notice not found");

            // Fetch the document or text
            let documentDataUrl = "#";
            let emailText: string | undefined = undefined;

            if (notice.fileName === "Email Intimation.txt") {
                try {
                    const fileName = "Email_Body.txt";
                    const s3Key = `${tenantId}/${notice.id}/${fileName}`;
                    const fileObj = await getFileObject(s3Key);
                    if (fileObj.Body) {
                        emailText = await fileObj.Body.transformToString();
                    }
                } catch (e) {
                    console.error("Failed to fetch email intimation body", e);
                }
            } else if (notice.fileUrl && notice.fileUrl !== "#") {
                try {
                    const fileName = notice.fileName ?? "document.pdf";
                    const ext = fileName.split('.').pop()?.toLowerCase();
                    const mimeType = ext === 'pdf' ? 'application/pdf'
                        : ext === 'png' ? 'image/png'
                            : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
                                : 'application/pdf';

                    // Reconstruct S3 key
                    const s3Key = `${tenantId}/${notice.id}/${fileName}`;
                    const fileObj = await getFileObject(s3Key);
                    if (fileObj.Body) {
                        const byteArray = await fileObj.Body.transformToByteArray();
                        const fileBase64 = Buffer.from(byteArray).toString("base64");
                        documentDataUrl = `data:${mimeType};base64,${fileBase64}`;
                    }
                } catch (err) {
                    console.error("[summarizeWithAI] Failed to fetch document from S3:", err);
                }
            }

            // Run AI extraction
            const extraction = await extractNoticeData(documentDataUrl === "#" ? null : documentDataUrl, "parallel", emailText);
            const amountPaise = extraction.data.amount ? extraction.data.amount * 100 : null;
            const riskLevel = calculateRiskLevel(extraction.data.deadline, amountPaise);
            // Always require human review after AI summarization
            const status = "review_needed";

            // Try to find client if we now have a PAN, GSTIN, or Name
            let matchedClientId = notice.clientId;
            if (!matchedClientId && (
                extraction.data.extractedGstin ||
                extraction.data.extractedPan ||
                extraction.data.extractedBusinessName ||
                extraction.data.extractedContactName
            )) {
                const extractionData = extraction.data;
                const clientConditions = [];
                if (extractionData.extractedGstin) clientConditions.push(eq(clients.gstin, extractionData.extractedGstin));
                if (extractionData.extractedPan) clientConditions.push(eq(clients.pan, extractionData.extractedPan));

                // Add fuzzy name matches as fallback
                if (extractionData.extractedBusinessName) clientConditions.push(ilike(clients.businessName, `%${extractionData.extractedBusinessName}%`));
                if (extractionData.extractedContactName) clientConditions.push(ilike(clients.contactName, `%${extractionData.extractedContactName}%`));

                if (clientConditions.length > 0) {
                    const matchedClients = await ctx.db.select().from(clients).where(
                        and(eq(clients.tenantId, tenantId), or(...clientConditions))
                    ).limit(1);

                    if (matchedClients[0]) {
                        matchedClientId = matchedClients[0].id;
                    }
                }
            }

            // Update database
            await ctx.db.transaction(async (tx) => {
                await tx
                    .update(notices)
                    .set({
                        authority: extraction.data.authority,
                        noticeType: extraction.data.noticeType,
                        amount: amountPaise,
                        deadline: extraction.data.deadline,
                        section: extraction.data.section,
                        financialYear: extraction.data.financialYear,
                        summary: extraction.data.summary,
                        nextSteps: extraction.data.nextSteps,
                        requiredDocuments: extraction.data.requiredDocuments,
                        confidence: extraction.confidence,
                        riskLevel,
                        status: status,
                        isTranslated: extraction.data.isTranslated,
                        originalLanguage: extraction.data.originalLanguage,
                        clientId: matchedClientId,
                        updatedAt: new Date(),
                    })
                    .where(and(eq(notices.id, input.id), eq(notices.tenantId, tenantId)));

                const auditId = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                await tx.insert(auditLogs).values({
                    id: auditId,
                    tenantId,
                    userId,
                    action: "notice.updated",
                    entityType: "notice",
                    entityId: input.id,
                    newValue: JSON.stringify({ action: "AI Summarization completed" }),
                    createdAt: new Date(),
                });
            });

            return { success: true };
        }),

    /**
     * Mark notice as verified
     */
    verify: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ ctx, input }) => {
            const tenantId = ctx.session.userId;
            const userId = ctx.session.userId;

            if (!tenantId) {
                throw new Error("No organization or user selected");
            }

            await ctx.db.transaction(async (tx) => {
                await tx
                    .update(notices)
                    .set({
                        status: "verified",
                        verifiedBy: userId,
                        verifiedAt: new Date(),
                        updatedAt: new Date(),
                    })
                    .where(and(eq(notices.id, input.id), eq(notices.tenantId, tenantId)));

                const auditId = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

                await tx.insert(auditLogs).values({
                    id: auditId,
                    tenantId,
                    userId,
                    action: "notice.verified",
                    entityType: "notice",
                    entityId: input.id,
                    newValue: JSON.stringify({ status: "verified" }),
                    createdAt: new Date(),
                });
            });

            return { success: true };
        }),

    /**
     * Update notice status (for Kanban drag-and-drop)
     * Includes Immutable Audit Logging
     */
    updateStatus: protectedProcedure
        .input(
            z.object({
                id: z.string(),
                status: z.enum(["processing", "review_needed", "verified", "in_progress", "closed"]),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const tenantId = ctx.session.userId;
            const userId = ctx.session.userId;

            if (!tenantId) {
                throw new Error("No organization or user selected");
            }

            await ctx.db.transaction(async (tx) => {
                const existing = await tx.query.notices.findFirst({
                    where: and(eq(notices.id, input.id), eq(notices.tenantId, tenantId)),
                    columns: { status: true }
                });
                const oldStatus = existing?.status || "unknown";

                const updateData: Record<string, unknown> = {
                    status: input.status,
                    updatedAt: new Date(),
                };

                if (input.status === "closed") {
                    updateData.closedAt = new Date();
                    updateData.closedBy = userId;
                }

                await tx
                    .update(notices)
                    .set(updateData)
                    .where(and(eq(notices.id, input.id), eq(notices.tenantId, tenantId)));

                const auditId = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

                await tx.insert(auditLogs).values({
                    id: auditId,
                    tenantId,
                    userId,
                    action: "notice.status_updated",
                    entityType: "notice",
                    entityId: input.id,
                    previousValue: JSON.stringify({ status: oldStatus }),
                    newValue: JSON.stringify({ status: input.status }),
                    createdAt: new Date(),
                });
            });

            return { success: true };
        }),

    /**
     * Assign (or unassign) a notice to a staff member (FR12)
     */
    assign: protectedProcedure
        .input(
            z.object({
                id: z.string(),
                assignedTo: z.string().nullable(), // Clerk user ID, or null to unassign
            })
        )
        .mutation(async ({ ctx, input }) => {
            const tenantId = ctx.session.userId;
            const userId = ctx.session.userId;
            if (!tenantId) throw new Error("No organization or user selected");

            await ctx.db.transaction(async (tx) => {
                const [existing] = await tx
                    .select({ assignedTo: notices.assignedTo })
                    .from(notices)
                    .where(and(eq(notices.id, input.id), eq(notices.tenantId, tenantId)));

                if (!existing) throw new Error("Notice not found");

                await tx
                    .update(notices)
                    .set({ assignedTo: input.assignedTo, updatedAt: new Date() })
                    .where(and(eq(notices.id, input.id), eq(notices.tenantId, tenantId)));

                const auditId = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                await tx.insert(auditLogs).values({
                    id: auditId,
                    tenantId,
                    userId,
                    action: "notice.assigned",
                    entityType: "notice",
                    entityId: input.id,
                    previousValue: JSON.stringify({ assignedTo: existing.assignedTo }),
                    newValue: JSON.stringify({ assignedTo: input.assignedTo }),
                    createdAt: new Date(),
                });
            });

            return { success: true };
        }),

    /**
     * Close a notice with mandatory proof of action (FR14 — Story 3.4)
     * Requires EITHER a response document OR a challan/reference number.
     */
    close: protectedProcedure
        .input(
            z.object({
                id: z.string(),
                closeReason: z.string().min(1),
                challanNumber: z.string().optional(),
                // Optional: base64 data URL of the proof document
                proofFileData: z.string().optional(),
                proofFileName: z.string().optional(),
                proofFileSize: z.number().optional(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const tenantId = ctx.session.userId;
            const userId = ctx.session.userId;
            if (!tenantId) throw new Error("No organization or user selected");

            // At least one form of proof is required
            if (!input.challanNumber && !input.proofFileData) {
                throw new Error("Proof of action required: upload a document or enter a challan/reference number.");
            }

            let proofFileUrl: string | null = null;

            // Upload proof document to S3 if provided
            if (input.proofFileData && input.proofFileName) {
                const { buffer, contentType } = dataUrlToBuffer(input.proofFileData);
                const fileKey = `${tenantId}/proof/${input.id}/${Date.now()}_${input.proofFileName}`;
                const { fileUrl, fileHash } = await uploadToS3(fileKey, buffer, contentType);
                proofFileUrl = fileUrl;

                const attachmentId = `attach_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                await ctx.db.insert(attachments).values({
                    id: attachmentId,
                    noticeId: input.id,
                    tenantId,
                    userId,
                    fileName: input.proofFileName,
                    fileUrl,
                    fileSize: input.proofFileSize ?? null,
                    fileHash,
                    createdAt: new Date(),
                });
            }

            await ctx.db.transaction(async (tx) => {
                await tx
                    .update(notices)
                    .set({
                        status: "closed",
                        closedAt: new Date(),
                        closedBy: userId,
                        updatedAt: new Date(),
                    })
                    .where(and(eq(notices.id, input.id), eq(notices.tenantId, tenantId)));

                const auditId = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                await tx.insert(auditLogs).values({
                    id: auditId,
                    tenantId,
                    userId,
                    action: "notice.closed",
                    entityType: "notice",
                    entityId: input.id,
                    newValue: JSON.stringify({
                        reason: input.closeReason,
                        challan: input.challanNumber ?? null,
                        proofUploaded: !!proofFileUrl,
                        proofUrl: proofFileUrl,
                    }),
                    createdAt: new Date(),
                });
            });

            return { success: true };
        }),

    /**
     * Soft-delete a notice (NFR12 — 7-year retention)
     */
    delete: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ ctx, input }) => {
            const tenantId = ctx.session.userId;
            if (!tenantId) {
                throw new Error("No organization or user selected");
            }

            await ctx.db
                .update(notices)
                .set({
                    deletedAt: new Date(),
                    updatedAt: new Date(),
                })
                .where(and(eq(notices.id, input.id), eq(notices.tenantId, tenantId)));

            return { success: true };
        }),

    /**
     * Dashboard stats for current tenant
     */
    stats: protectedProcedure.query(async ({ ctx }) => {
        const tenantId = ctx.session.userId;
        if (!tenantId) {
            return { total: 0, reviewNeeded: 0, processing: 0, verified: 0, inProgress: 0, closed: 0, highRisk: 0 };
        }

        const allNotices = await ctx.db
            .select({
                status: notices.status,
                riskLevel: notices.riskLevel,
            })
            .from(notices)
            .where(and(eq(notices.tenantId, tenantId), isNull(notices.deletedAt)));

        return {
            total: allNotices.length,
            reviewNeeded: allNotices.filter((n) => n.status === "review_needed").length,
            processing: allNotices.filter((n) => n.status === "processing").length,
            verified: allNotices.filter((n) => n.status === "verified").length,
            inProgress: allNotices.filter((n) => n.status === "in_progress").length,
            closed: allNotices.filter((n) => n.status === "closed").length,
            highRisk: allNotices.filter((n) => n.riskLevel === "high").length,
        };
    }),



    /**
     * Flag a template issue for dev team review
     */
    flagTemplateIssue: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ ctx, input }) => {
            const tenantId = ctx.session.userId;
            const userId = ctx.session.userId;

            if (!tenantId) {
                throw new Error("No organization or user selected");
            }

            await ctx.db.transaction(async (tx) => {
                await tx
                    .update(notices)
                    .set({
                        hasTemplateIssue: true,
                        updatedAt: new Date(),
                    })
                    .where(and(eq(notices.id, input.id), eq(notices.tenantId, tenantId)));

                const auditId = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

                await tx.insert(auditLogs).values({
                    id: auditId,
                    tenantId,
                    userId,
                    action: "notice.template_issue_flagged",
                    entityType: "notice",
                    entityId: input.id,
                    newValue: JSON.stringify({ hasTemplateIssue: true }),
                    createdAt: new Date(),
                });
            });

            // Mock Dev Team Alert
            console.warn(`[DEV ALERT] Template Issue flagged by user ${userId} for Notice ${input.id}`);

            return { success: true };
        }),

    /**
     * Client approves a drafted response (FR18 — Story 4.4)
     */
    approveResponse: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ ctx, input }) => {
            const tenantId = ctx.session.userId;
            const userId = ctx.session.userId;
            if (!tenantId) throw new Error("No organization or user selected");

            await ctx.db.transaction(async (tx) => {
                await tx
                    .update(notices)
                    .set({ status: "approved", updatedAt: new Date() })
                    .where(and(eq(notices.id, input.id), eq(notices.tenantId, tenantId)));

                const auditId = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                await tx.insert(auditLogs).values({
                    id: auditId,
                    tenantId,
                    userId,
                    action: "notice.approved",
                    entityType: "notice",
                    entityId: input.id,
                    newValue: JSON.stringify({ status: "approved", approvedBy: userId }),
                    createdAt: new Date(),
                });
            });

            return { success: true };
        }),

    /**
     * Get all response attachments for a notice
     */
    getAttachments: protectedProcedure
        .input(z.object({ noticeId: z.string() }))
        .query(async ({ ctx, input }) => {
            const tenantId = ctx.session.userId;
            if (!tenantId) return [];

            return ctx.db
                .select()
                .from(attachments)
                .where(
                    and(
                        eq(attachments.noticeId, input.noticeId),
                        eq(attachments.tenantId, tenantId)
                    )
                )
                .orderBy(desc(attachments.createdAt));
        }),

    /**
     * Link an uploaded response document to a notice (Immutable Ledger)
     */
    addAttachment: protectedProcedure
        .input(
            z.object({
                noticeId: z.string(),
                fileName: z.string(),
                fileUrl: z.string(),
                fileSize: z.number().optional(),
                fileHash: z.string().optional(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const tenantId = ctx.session.userId;
            const userId = ctx.session.userId;
            if (!tenantId) throw new Error("No organization or user selected");

            const attachmentId = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

            await ctx.db.transaction(async (tx) => {
                await tx.insert(attachments).values({
                    id: attachmentId,
                    noticeId: input.noticeId,
                    tenantId,
                    userId,
                    fileName: input.fileName,
                    fileUrl: input.fileUrl,
                    fileSize: input.fileSize ?? null,
                    fileHash: input.fileHash ?? null,
                    createdAt: new Date(),
                });

                const auditId = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                await tx.insert(auditLogs).values({
                    id: auditId,
                    tenantId,
                    userId,
                    action: "attachment.added",
                    entityType: "notice",
                    entityId: input.noticeId,
                    newValue: JSON.stringify({
                        attachmentId,
                        fileName: input.fileName,
                        fileUrl: input.fileUrl
                    }),
                    createdAt: new Date(),
                });
            });

            return { success: true, attachmentId };
        }),
});
