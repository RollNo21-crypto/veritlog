import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { auditLogs, notices } from "~/server/db/schema";
import { eq, and, desc } from "drizzle-orm";

export const auditRouter = createTRPCRouter({
    /**
     * List audit trail for a specific notice
     */
    listForNotice: protectedProcedure
        .input(z.object({ noticeId: z.string() }))
        .query(async ({ ctx, input }) => {
            const tenantId = ctx.session.userId;
            if (!tenantId) return [];

            return ctx.db
                .select()
                .from(auditLogs)
                .where(
                    and(
                        eq(auditLogs.entityId, input.noticeId),
                        eq(auditLogs.tenantId, tenantId),
                        eq(auditLogs.entityType, "notice")
                    )
                )
                .orderBy(desc(auditLogs.createdAt));
        }),

    /**
     * List recent audit events across all notices (for ops monitoring)
     */
    listRecent: protectedProcedure
        .input(z.object({ limit: z.number().min(1).max(100).default(50) }))
        .query(async ({ ctx, input }) => {
            const tenantId = ctx.session.userId;
            if (!tenantId) return [];

            return ctx.db
                .select({
                    id: auditLogs.id,
                    userId: auditLogs.userId,
                    action: auditLogs.action,
                    entityType: auditLogs.entityType,
                    entityId: auditLogs.entityId,
                    createdAt: auditLogs.createdAt,
                })
                .from(auditLogs)
                .where(eq(auditLogs.tenantId, tenantId))
                .orderBy(desc(auditLogs.createdAt))
                .limit(input.limit);
        }),

    /**
     * Log an audit event (called from server-side actions)
     */
    log: protectedProcedure
        .input(
            z.object({
                action: z.string(),
                entityType: z.string(),
                entityId: z.string(),
                previousValue: z.string().optional(),
                newValue: z.string().optional(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const tenantId = ctx.session.userId;
            if (!tenantId) throw new Error("No organization selected");

            const logId = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

            await ctx.db.insert(auditLogs).values({
                id: logId,
                tenantId,
                userId: ctx.session.userId,
                action: input.action,
                entityType: input.entityType,
                entityId: input.entityId,
                previousValue: input.previousValue ?? null,
                newValue: input.newValue ?? null,
                createdAt: new Date(),
            });

            return { id: logId };
        }),
});
