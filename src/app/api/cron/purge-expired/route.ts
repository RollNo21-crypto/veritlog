import { type NextRequest, NextResponse } from "next/server";
import { db } from "~/server/db";
import { notices, auditLogs, attachments, comments } from "~/server/db/schema";
import { and, lt, isNotNull, sql, eq } from "drizzle-orm";

/**
 * Story 6.2 — Data Retention & Permanent Purge
 * GET /api/cron/purge-expired
 *
 * Permanently deletes records that have been soft-deleted for > 7 years.
 * Complies with Companies Act & GST Act retention requirements (NFR12).
 *
 * Schedule: 1st of every month at 2AM UTC (see vercel.json)
 * Security: protected by CRON_SECRET header
 */
export async function GET(req: NextRequest) {
    const secret = req.headers.get("x-cron-secret");
    if (secret !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 7 years ago from today
    const sevenYearsAgo = new Date();
    sevenYearsAgo.setFullYear(sevenYearsAgo.getFullYear() - 7);

    // Find expired notice IDs (soft-deleted > 7 years ago)
    const expiredNotices = await db
        .select({ id: notices.id })
        .from(notices)
        .where(
            and(
                isNotNull(notices.deletedAt),
                lt(notices.deletedAt, sevenYearsAgo)
            )
        );

    if (expiredNotices.length === 0) {
        return NextResponse.json({
            purged: 0,
            message: "No records eligible for permanent purge",
            cutoffDate: sevenYearsAgo.toISOString(),
        });
    }

    const expiredIds = expiredNotices.map((n) => n.id);
    let purgedComments = 0;
    let purgedAttachments = 0;
    let purgedAuditLogs = 0;
    let purgedNotices = 0;

    // Delete child records first (FK order), then parent notice
    for (const noticeId of expiredIds) {
        // Delete comments for this notice
        const deletedComments = await db
            .delete(comments)
            .where(eq(comments.noticeId, noticeId))
            .returning({ id: comments.id });
        purgedComments += deletedComments.length;

        // Delete attachments for this notice
        const deletedAttachments = await db
            .delete(attachments)
            .where(eq(attachments.noticeId, noticeId))
            .returning({ id: attachments.id });
        purgedAttachments += deletedAttachments.length;

        // Delete audit logs for this notice
        const deletedLogs = await db
            .delete(auditLogs)
            .where(
                and(
                    eq(auditLogs.entityId, noticeId),
                    eq(auditLogs.entityType, "notice")
                )
            )
            .returning({ id: auditLogs.id });
        purgedAuditLogs += deletedLogs.length;

        // Finally delete the notice itself
        await db
            .delete(notices)
            .where(
                and(
                    eq(notices.id, noticeId),
                    isNotNull(notices.deletedAt),
                    lt(notices.deletedAt, sevenYearsAgo)
                )
            );
        purgedNotices++;
    }

    console.log(`[Purge] Permanently deleted ${purgedNotices} notices older than 7 years.`);

    return NextResponse.json({
        purged: purgedNotices,
        purgedComments,
        purgedAttachments,
        purgedAuditLogs,
        cutoffDate: sevenYearsAgo.toISOString(),
        timestamp: new Date().toISOString(),
        message: `Permanently purged ${purgedNotices} notices and all child records (7-year retention policy).`,
    });
}
