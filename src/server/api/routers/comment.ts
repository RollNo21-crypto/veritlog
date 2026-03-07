import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { comments } from "~/server/db/schema";
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

            await ctx.db.insert(comments).values({
                id: commentId,
                noticeId: input.noticeId,
                tenantId,
                userId: ctx.session.userId,
                content: input.content,
                createdAt: new Date(),
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

            await ctx.db
                .delete(comments)
                .where(
                    and(
                        eq(comments.id, input.id),
                        eq(comments.tenantId, tenantId)
                    )
                );

            return { success: true };
        }),
});
