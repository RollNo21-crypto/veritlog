import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { extractNoticeData } from "~/server/services/extraction";
import { notices } from "~/server/db/schema";
import { eq, and } from "drizzle-orm";

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
                fileData: z.string(), // base64 or R2 URL
            })
        )
        .mutation(async ({ ctx, input }) => {
            const tenantId = ctx.session.orgId;
            if (!tenantId) {
                throw new Error("No organization selected");
            }

            const fileUrl = input.fileData;
            const extraction = await extractNoticeData(fileUrl, "mock");
            const status = extraction.confidence === "low" ? "review_needed" : "processing";
            const noticeId = `notice_${Date.now()}`;

            await ctx.db.insert(notices).values({
                id: noticeId,
                tenantId,
                fileName: input.fileName,
                fileUrl,
                fileSize: input.fileSize,
                authority: extraction.data.authority,
                noticeType: extraction.data.noticeType,
                amount: extraction.data.amount ? extraction.data.amount * 100 : null,
                deadline: extraction.data.deadline,
                section: extraction.data.section,
                financialYear: extraction.data.financialYear,
                confidence: extraction.confidence,
                status,
                source: "upload",
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            return {
                noticeId,
                extraction: extraction.data,
                confidence: extraction.confidence,
                status,
                processingTime: extraction.processingTime,
            };
        }),

    /**
     * List notices for current tenant
     */
    list: protectedProcedure
        .input(
            z.object({
                status: z.enum(["processing", "review_needed", "verified", "in_progress", "closed"]).optional(),
            }).optional()
        )
        .query(async ({ ctx, input }) => {
            const tenantId = ctx.session.orgId;
            if (!tenantId) {
                return [];
            }

            const conditions = [eq(notices.tenantId, tenantId)];
            if (input?.status) {
                conditions.push(eq(notices.status, input.status));
            }

            return await ctx.db
                .select()
                .from(notices)
                .where(and(...conditions))
                .orderBy(notices.createdAt);
        }),

    /**
     * Get single notice by ID
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
                .where(and(eq(notices.id, input.id), eq(notices.tenantId, tenantId)))
                .limit(1);

            return result[0] || null;
        }),

    /**
     * Update notice fields
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
            })
        )
        .mutation(async ({ ctx, input }) => {
            const tenantId = ctx.session.orgId;
            if (!tenantId) {
                throw new Error("No organization selected");
            }

            const { id, ...updates } = input;

            await ctx.db
                .update(notices)
                .set({ ...updates, updatedAt: new Date() })
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

            await ctx.db
                .update(notices)
                .set({ status: input.status, updatedAt: new Date() })
                .where(and(eq(notices.id, input.id), eq(notices.tenantId, tenantId)));

            return { success: true };
        }),
});
