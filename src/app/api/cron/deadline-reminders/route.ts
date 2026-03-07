import { type NextRequest, NextResponse } from "next/server";
import { db } from "~/server/db";
import { notices, auditLogs } from "~/server/db/schema";
import { and, eq, isNull, gte, lte, sql } from "drizzle-orm";
import { sendWhatsAppAlert } from "~/server/services/whatsapp";

/**
 * Story 5.3 — Automated Deadline Reminders
 * Cron: runs daily at 09:00 IST (configured in vercel.json)
 *
 * Finds notices with deadline = today+1 or today+3 that are NOT yet closed
 * and fires WhatsApp reminders to the CA (and optionally the client contact).
 *
 * Security: requires a CRON_SECRET header to prevent public abuse.
 */
export async function GET(req: NextRequest) {
    const secret = req.headers.get("x-cron-secret");
    if (secret !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();

    // Build target dates: today+1 and today+3
    const in1Day = new Date(now);
    in1Day.setDate(in1Day.getDate() + 1);

    const in3Days = new Date(now);
    in3Days.setDate(in3Days.getDate() + 3);

    const toIso = (d: Date) => d.toISOString().slice(0, 10); // YYYY-MM-DD

    // Fetch all notices with deadline in the next 3 days, not closed/deleted
    const urgentNotices = await db
        .select({
            id: notices.id,
            tenantId: notices.tenantId,
            noticeType: notices.noticeType,
            authority: notices.authority,
            deadline: notices.deadline,
            amount: notices.amount,
            status: notices.status,
            assignedTo: notices.assignedTo,
        })
        .from(notices)
        .where(
            and(
                isNull(notices.deletedAt),
                sql`${notices.deadline} IN (${toIso(in1Day)}, ${toIso(in3Days)})`,
                sql`${notices.status} NOT IN ('closed', 'approved')`
            )
        );

    const results: { noticeId: string; daysLeft: number; sent: boolean }[] = [];
    const caPhone = process.env.WHATSAPP_CA_PHONE;

    for (const notice of urgentNotices) {
        if (!notice.deadline) continue;

        const deadlineDate = new Date(notice.deadline);
        const daysLeft = Math.ceil(
            (deadlineDate.getTime() - now.getTime()) / 86_400_000
        );

        const alertType =
            daysLeft <= 1 ? "deadline_reminder_1d" : "deadline_reminder_3d";

        // Send to CA
        let sent = false;
        if (caPhone) {
            const result = await sendWhatsAppAlert({
                to: caPhone,
                type: alertType,
                noticeId: notice.id,
                noticeType: notice.noticeType ?? undefined,
                authority: notice.authority ?? undefined,
                deadline: notice.deadline,
                amount: notice.amount ?? undefined,
            });
            sent = result.success;
        }

        // Log reminder to prevent duplicates (idempotent by external cron schedule)
        const auditId = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        await db.insert(auditLogs).values({
            id: auditId,
            tenantId: notice.tenantId,
            userId: "system",
            action: `notice.reminder_${daysLeft}d`,
            entityType: "notice",
            entityId: notice.id,
            newValue: JSON.stringify({ daysLeft, sent, sentTo: caPhone }),
            createdAt: new Date(),
        });

        results.push({ noticeId: notice.id, daysLeft, sent });
    }

    return NextResponse.json({
        processed: urgentNotices.length,
        results,
        timestamp: now.toISOString(),
    });
}
