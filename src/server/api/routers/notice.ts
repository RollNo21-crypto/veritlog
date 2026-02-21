import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { extractNoticeData } from "~/server/services/extraction";
import { uploadToR2, dataUrlToBuffer, getFileViewUrl } from "~/server/services/storage";
import { notices } from "~/server/db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";

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
            })
        )
        .mutation(async ({ ctx, input }) => {
            const tenantId = ctx.session.orgId;
            if (!tenantId) {
                throw new Error("No organization selected");
            }

            const noticeId = `notice_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            const fileKey = `${tenantId}/${noticeId}/${input.fileName}`;

            // Upload file to R2 (falls back to placeholder URL in local dev)
            let fileUrl: string;
            let fileHash: string = "";
            if (input.fileData.startsWith("data:")) {
                const { buffer, contentType } = dataUrlToBuffer(input.fileData);
                const r2Result = await uploadToR2(ctx.r2, fileKey, buffer, contentType);
                fileUrl = getFileViewUrl(noticeId); // Use proxy route for secure access
                fileHash = r2Result.fileHash;
            } else {
                // Already a URL (e.g., email attachment previously uploaded)
                fileUrl = input.fileData;
            }

            // Run AI extraction (uses file URL or base64 content)
            const extraction = await extractNoticeData(fileUrl, "mock");
            const amountPaise = extraction.data.amount ? extraction.data.amount * 100 : null;
            const riskLevel = calculateRiskLevel(extraction.data.deadline, amountPaise);
            const status = extraction.confidence === "low" ? "review_needed" : "processing";

            await ctx.db.insert(notices).values({
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
                confidence: extraction.confidence,
                riskLevel,
                status,
                source: "upload",
                createdAt: new Date(),
                updatedAt: new Date(),
            });

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
                    riskLevel: z.enum(["high", "medium", "low"]).optional(),
                })
                .optional()
        )
        .query(async ({ ctx, input }) => {
            const tenantId = ctx.session.orgId;
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
            if (input?.riskLevel) {
                conditions.push(eq(notices.riskLevel, input.riskLevel));
            }

            return await ctx.db
                .select()
                .from(notices)
                .where(and(...conditions))
                .orderBy(desc(notices.createdAt));
        }),

    /**
     * Get single notice by ID (with tenant isolation)
     */
    getById: protectedProcedure
        .input(z.object({ id: z.string() }))
        .query(async ({ ctx, input }) => {
            const tenantId = ctx.session.orgId;
            if (!tenantId) {
                throw new Error("No organization selected");
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
            const tenantId = ctx.session.orgId;
            if (!tenantId) {
                throw new Error("No organization selected");
            }

            const { id, ...updates } = input;

            // Recalculate risk if deadline or amount changed
            let riskLevel: string | undefined;
            if (updates.deadline !== undefined || updates.amount !== undefined) {
                // Fetch current values to combine with updates
                const current = await ctx.db
                    .select({ deadline: notices.deadline, amount: notices.amount })
                    .from(notices)
                    .where(and(eq(notices.id, id), eq(notices.tenantId, tenantId)))
                    .limit(1);

                if (current[0]) {
                    const newDeadline = updates.deadline ?? current[0].deadline;
                    const newAmount = updates.amount !== undefined ? updates.amount : current[0].amount;
                    riskLevel = calculateRiskLevel(newDeadline ?? null, newAmount);
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
     * Mark notice as verified
     */
    verify: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ ctx, input }) => {
            const tenantId = ctx.session.orgId;
            const userId = ctx.session.userId;

            if (!tenantId) {
                throw new Error("No organization selected");
            }

            await ctx.db
                .update(notices)
                .set({
                    status: "verified",
                    verifiedBy: userId,
                    verifiedAt: new Date(),
                    updatedAt: new Date(),
                })
                .where(and(eq(notices.id, input.id), eq(notices.tenantId, tenantId)));

            return { success: true };
        }),

    /**
     * Update notice status (for Kanban drag-and-drop)
     */
    updateStatus: protectedProcedure
        .input(
            z.object({
                id: z.string(),
                status: z.enum(["processing", "review_needed", "verified", "in_progress", "closed"]),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const tenantId = ctx.session.orgId;
            if (!tenantId) {
                throw new Error("No organization selected");
            }

            const updateData: Record<string, unknown> = {
                status: input.status,
                updatedAt: new Date(),
            };

            // Track closure
            if (input.status === "closed") {
                updateData.closedAt = new Date();
                updateData.closedBy = ctx.session.userId;
            }

            await ctx.db
                .update(notices)
                .set(updateData)
                .where(and(eq(notices.id, input.id), eq(notices.tenantId, tenantId)));

            return { success: true };
        }),

    /**
     * Assign notice to a staff member
     */
    assign: protectedProcedure
        .input(
            z.object({
                id: z.string(),
                assignedTo: z.string(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const tenantId = ctx.session.orgId;
            if (!tenantId) {
                throw new Error("No organization selected");
            }

            await ctx.db
                .update(notices)
                .set({
                    assignedTo: input.assignedTo,
                    updatedAt: new Date(),
                })
                .where(and(eq(notices.id, input.id), eq(notices.tenantId, tenantId)));

            return { success: true };
        }),

    /**
     * Close a notice with an optional reason (closing workflow)
     */
    close: protectedProcedure
        .input(
            z.object({
                id: z.string(),
                closeReason: z.string().optional(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const tenantId = ctx.session.orgId;
            if (!tenantId) throw new Error("No organization selected");

            await ctx.db
                .update(notices)
                .set({
                    status: "closed",
                    closedAt: new Date(),
                    closedBy: ctx.session.userId,
                    // Store close reason in summary for audit trail
                    ...(input.closeReason ? { summary: `Closed: ${input.closeReason}` } : {}),
                    updatedAt: new Date(),
                })
                .where(and(eq(notices.id, input.id), eq(notices.tenantId, tenantId)));

            return { success: true };
        }),

    /**
     * Soft-delete a notice (NFR12 — 7-year retention)
     */
    delete: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ ctx, input }) => {
            const tenantId = ctx.session.orgId;
            if (!tenantId) {
                throw new Error("No organization selected");
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
        const tenantId = ctx.session.orgId;
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
});
