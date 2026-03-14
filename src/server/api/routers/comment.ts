import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { summarizeActionText } from "~/server/services/extraction";
import { comments, auditLogs } from "~/server/db/schema";
import { eq, and, desc } from "drizzle-orm";

export const commentRouter = createTRPCRouter({
    /**
     * List all comments for a notice (ordered newest-last for thread display)
     */
    list: protectedProcedure
        .input(z.object({ noticeId: z.string() }))
        .query(async ({ ctx, input }) => {
            const tenantId = ctx.session.userId;
            if (!tenantId) return [];

            return ctx.db
                .select()
                .from(comments)
                .where(
                    and(
                        eq(comments.noticeId, input.noticeId),
                        eq(comments.tenantId, tenantId)
                    )
                )
                .orderBy(comments.createdAt);
        }),

    /**
     * Add a comment to a notice
     */
    create: protectedProcedure
        .input(
            z.object({
                noticeId: z.string(),
                content: z.string().min(1).max(2000),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const tenantId = ctx.session.userId;
            if (!tenantId) throw new Error("No organization selected");

            const commentId = `comment_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

            let summary: string | null = null;
            if (input.content.length > 150) {
                summary = await summarizeActionText(input.content.substring(0, 3000));
            }

            await ctx.db.transaction(async (tx) => {
                await tx.insert(comments).values({
                    id: commentId,
                    noticeId: input.noticeId,
                    tenantId,
                    userId: ctx.session.userId,
                    content: input.content,
                    summary,
                    createdAt: new Date(),
                });

                const auditId = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                await tx.insert(auditLogs).values({
                    id: auditId,
                    tenantId,
                    userId: ctx.session.userId,
                    action: "comment.added",
                    entityType: "notice",
                    entityId: input.noticeId,
                    newValue: JSON.stringify({ commentId, summary: summary || "No summary" }),
                    createdAt: new Date(),
                });
            });

            return { id: commentId };
        }),

    /**
     * Delete own comment (staff can delete any within tenant)
     */
    delete: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ ctx, input }) => {
            const tenantId = ctx.session.userId;
            if (!tenantId) throw new Error("No organization selected");

            await ctx.db.transaction(async (tx) => {
                // Get comment details for the audit log before deleting
                const [comment] = await tx
                    .select()
                    .from(comments)
                    .where(and(eq(comments.id, input.id), eq(comments.tenantId, tenantId)))
                    .limit(1);

                if (!comment) return { success: false };

                await tx
                    .delete(comments)
                    .where(
                        and(
                            eq(comments.id, input.id),
                            eq(comments.tenantId, tenantId)
                        )
                    );

                const auditId = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                await tx.insert(auditLogs).values({
                    id: auditId,
                    tenantId,
                    userId: ctx.session.userId,
                    action: "comment.deleted",
                    entityType: "notice",
                    entityId: comment.noticeId,
                    previousValue: JSON.stringify({ commentId: input.id }),
                    createdAt: new Date(),
                });
            });

            return { success: true };
        }),
});
