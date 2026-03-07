import { NextResponse } from "next/server";
import { db } from "~/server/db";
import { notices, auditLogs } from "~/server/db/schema";
import { eq, and, isNull, notInArray } from "drizzle-orm";
import { alertDeadlineApproaching } from "~/server/services/whatsapp";

export async function GET(req: Request) {
    // Verify cron job secret if needed (Vercel uses CRON_SECRET)
    const authHeader = req.headers.get("authorization");
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        // Find notices not closed/verified
        const activeNotices = await db
            .select()
            .from(notices)
            .where(
                and(
                    isNull(notices.deletedAt),
                    notInArray(notices.status, ["verified", "closed", "approved"])
                )
            );

        const now = new Date();
        const escalatedIds: string[] = [];

        for (const notice of activeNotices) {
            if (!notice.deadline) continue;

            const deadlineDate = new Date(notice.deadline);
            const daysLeft = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

            if (daysLeft > 3 || daysLeft < 0) continue; // Only alert for 0-3 days out

            const alertAction = daysLeft <= 1 ? "notice.reminder_1d" : "notice.reminder_3d";

            // Check if we already sent this exact reminder type
            const existingLog = await db
                .select()
                .from(auditLogs)
                .where(
                    and(
                        eq(auditLogs.entityId, notice.id),
                        eq(auditLogs.action, alertAction)
                    )
                )
                .limit(1);

            if (existingLog.length > 0) continue; // Already escalated

            // Send escalating alert
            await alertDeadlineApproaching({
                noticeId: notice.id,
                noticeType: notice.noticeType,
                authority: notice.authority,
                deadline: notice.deadline,
                amount: notice.amount,
                daysLeft,
            });

            // Log it
            await db.insert(auditLogs).values({
                id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                tenantId: notice.tenantId,
                userId: "system",
                entityId: notice.id,
                entityType: "notice",
                action: alertAction,
                createdAt: new Date(),
            });

            escalatedIds.push(notice.id);
        }

        return NextResponse.json({ success: true, escalatedCount: escalatedIds.length, escalatedIds });
    } catch (e) {
        console.error("Watchdog Cron Error:", e);
        return NextResponse.json({ error: "Watchdog failed" }, { status: 500 });
    }
}
