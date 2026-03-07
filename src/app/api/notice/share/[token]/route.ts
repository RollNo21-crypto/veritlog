import { type NextRequest, NextResponse } from "next/server";
import { verifyShareToken } from "~/server/services/shareToken";
import { db } from "~/server/db";
import { notices } from "~/server/db/schema";
import { and, eq, isNull } from "drizzle-orm";

/**
 * Public API: GET /api/notice/share/[token]
 * Returns notice summary data for the deep-link page — no auth required.
 * The token itself is the proof of access (HMAC-signed, 7-day expiry).
 */
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    const resolvedParams = await params;
    const payload = verifyShareToken(resolvedParams.token);
    if (!payload) {
        return NextResponse.json({ error: "Invalid or expired link" }, { status: 401 });
    }

    const [notice] = await db
        .select({
            id: notices.id,
            noticeType: notices.noticeType,
            authority: notices.authority,
            amount: notices.amount,
            deadline: notices.deadline,
            status: notices.status,
            riskLevel: notices.riskLevel,
            summary: notices.summary,
        })
        .from(notices)
        .where(
            and(
                eq(notices.id, payload.noticeId),
                eq(notices.tenantId, payload.tenantId),
                isNull(notices.deletedAt)
            )
        )
        .limit(1);

    if (!notice) {
        return NextResponse.json({ error: "Notice not found" }, { status: 404 });
    }

    return NextResponse.json({ notice, exp: payload.exp });
}
