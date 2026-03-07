import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { notices, auditLogs } from "~/server/db/schema";
import { eq, and, isNull, desc, notInArray, sql } from "drizzle-orm";

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

    /**
     * Financial Exposure Radar
     * Aggregates total money at risk from active notices
     */
    financialExposure: protectedProcedure.query(async ({ ctx }) => {
        const tenantId = ctx.session.userId;
        if (!tenantId) return null;

        const activeNotices = await ctx.db
            .select({
                id: notices.id,
                amount: notices.amount,
                riskLevel: notices.riskLevel,
                authority: notices.authority,
                deadline: notices.deadline,
                noticeType: notices.noticeType,
                status: notices.status,
            })
            .from(notices)
            .where(
                and(
                    eq(notices.tenantId, tenantId),
                    isNull(notices.deletedAt),
                    notInArray(notices.status, ["closed", "approved"])
                )
            );

        let totalExposurePaise = 0;
        let highRiskExposurePaise = 0;
        let mediumRiskExposurePaise = 0;
        let lowRiskExposurePaise = 0;
        const byAuthority: Record<string, number> = {};

        for (const n of activeNotices) {
            const amount = n.amount ?? 0;
            totalExposurePaise += amount;

            if (n.riskLevel === "high") highRiskExposurePaise += amount;
            else if (n.riskLevel === "medium") mediumRiskExposurePaise += amount;
            else lowRiskExposurePaise += amount;

            const authority = n.authority?.trim() ?? "Unknown";
            byAuthority[authority] = (byAuthority[authority] ?? 0) + amount;
        }

        const topAuthorities = Object.entries(byAuthority)
            .map(([name, amountPaise]) => ({ name, amountPaise, amountRupees: amountPaise / 100 }))
            .sort((a, b) => b.amountPaise - a.amountPaise)
            .slice(0, 5);

        return {
            totalExposureRupees: totalExposurePaise / 100,
            highRiskRupees: highRiskExposurePaise / 100,
            mediumRiskRupees: mediumRiskExposurePaise / 100,
            lowRiskRupees: lowRiskExposurePaise / 100,
            activeNoticeCount: activeNotices.length,
            topAuthorities,
        };
    }),
});
