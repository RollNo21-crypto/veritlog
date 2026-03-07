import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { notices, auditLogs } from "~/server/db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";

export const statsRouter = createTRPCRouter({
    /**
     * Full rich Ops Dashboard stats
     * Returns extraction accuracy, status pipeline breakdown, risk distribution,
     * and a recent activity feed
     */
    opsDashboard: protectedProcedure.query(async ({ ctx }) => {
        const tenantId = ctx.session.userId;
        if (!tenantId) {
            return {
                authorities: [],
                globalAccuracy: 0,
                totalProcessed: 0,
                statusBreakdown: {},
                riskBreakdown: { high: 0, medium: 0, low: 0, none: 0 },
                recentEvents: [],
            };
        }

        // Fetch all non-deleted notices
        const allNotices = await ctx.db
            .select({
                authority: notices.authority,
                confidence: notices.confidence,
                status: notices.status,
                riskLevel: notices.riskLevel,
            })
            .from(notices)
            .where(and(eq(notices.tenantId, tenantId), isNull(notices.deletedAt)));

        // Recent audit events
        const recentEvents = await ctx.db
            .select({
                id: auditLogs.id,
                action: auditLogs.action,
                entityId: auditLogs.entityId,
                userId: auditLogs.userId,
                createdAt: auditLogs.createdAt,
            })
            .from(auditLogs)
            .where(eq(auditLogs.tenantId, tenantId))
            .orderBy(desc(auditLogs.createdAt))
            .limit(10);

        if (allNotices.length === 0) {
            return {
                authorities: [],
                globalAccuracy: 0,
                totalProcessed: 0,
                statusBreakdown: {} as Record<string, number>,
                riskBreakdown: { high: 0, medium: 0, low: 0, none: 0 },
                recentEvents,
            };
        }

        const authorityMap = new Map<string, { total: number; highConfidence: number }>();
        const statusBreakdown: Record<string, number> = {};
        const riskBreakdown = { high: 0, medium: 0, low: 0, none: 0 };

        let totalProcessed = 0;
        let totalHighConfidence = 0;

        for (const notice of allNotices) {
            const authority = notice.authority?.trim() || "Unknown Authority";
            totalProcessed++;

            // Accuracy
            const isAccurate = notice.confidence === "high";
            if (isAccurate) totalHighConfidence++;

            // Authority map
            if (!authorityMap.has(authority)) {
                authorityMap.set(authority, { total: 0, highConfidence: 0 });
            }
            const stats = authorityMap.get(authority)!;
            stats.total++;
            if (isAccurate) stats.highConfidence++;

            // Status breakdown
            const status = notice.status ?? "unknown";
            statusBreakdown[status] = (statusBreakdown[status] ?? 0) + 1;

            // Risk breakdown
            const risk = notice.riskLevel ?? "none";
            if (risk === "high") riskBreakdown.high++;
            else if (risk === "medium") riskBreakdown.medium++;
            else if (risk === "low") riskBreakdown.low++;
            else riskBreakdown.none++;
        }

        const authorities = Array.from(authorityMap.entries())
            .map(([name, stats]) => ({
                name,
                totalNotices: stats.total,
                accuracyPercent: Math.round((stats.highConfidence / stats.total) * 100),
            }))
            .sort((a, b) => b.totalNotices - a.totalNotices);

        const globalAccuracy = Math.round((totalHighConfidence / totalProcessed) * 100);

        return {
            authorities,
            globalAccuracy,
            totalProcessed,
            statusBreakdown,
            riskBreakdown,
            recentEvents,
        };
    }),
});
