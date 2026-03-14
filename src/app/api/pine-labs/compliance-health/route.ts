import { NextResponse } from "next/server";
import { db } from "~/server/db";
import { notices, tenants } from "~/server/db/schema";
import { eq, and, isNull, inArray } from "drizzle-orm";

/**
 * Pine Labs Compliance Health Endpoint
 *
 * Called by Pine Labs settlement engine to verify a merchant's regulatory
 * standing before releasing payment settlements.
 *
 * GET /api/pine-labs/compliance-health?tenant_id=<id>
 *
 * Authentication: Bearer token via PINE_LABS_WEBHOOK_SECRET env var.
 *
 * Response:
 * {
 *   tenantId: string,
 *   complianceScore: number,        // 0–100
 *   settlementAllowed: boolean,     // false if any critical risk block exists
 *   openHighRiskCount: number,
 *   overdueCount: number,
 *   riskSummary: string
 * }
 */
export async function GET(req: Request) {
    // ── Authentication ──────────────────────────────────────────────────────────
    const apiSecret = process.env.PINE_LABS_WEBHOOK_SECRET;
    if (apiSecret) {
        const authHeader = req.headers.get("authorization");
        if (authHeader !== `Bearer ${apiSecret}`) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
    }

    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get("tenant_id");

    if (!tenantId) {
        return NextResponse.json(
            { error: "Missing required query param: tenant_id" },
            { status: 400 }
        );
    }

    try {
        // ── Tenant Lookup ──────────────────────────────────────────────────────
        const tenant = await db
            .select()
            .from(tenants)
            .where(eq(tenants.id, tenantId))
            .limit(1)
            .then((rows) => rows[0]);

        if (!tenant) {
            return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
        }

        // ── Fetch all open notices ─────────────────────────────────────────────
        const openNotices = await db
            .select({
                id: notices.id,
                riskLevel: notices.riskLevel,
                status: notices.status,
                deadline: notices.deadline,
                noticeType: notices.noticeType,
                authority: notices.authority,
                amount: notices.amount,
            })
            .from(notices)
            .where(
                and(
                    eq(notices.tenantId, tenantId),
                    isNull(notices.deletedAt),
                    // Exclude successfully resolved notices
                    inArray(notices.status, ["processing", "review_needed", "verified", "in_progress"])
                )
            );

        // ── Scoring Logic ─────────────────────────────────────────────────────
        const now = new Date();
        let score = 100;
        let overdueCount = 0;
        let openHighRiskCount = 0;
        const riskFlags: string[] = [];

        for (const notice of openNotices) {
            // Check for high risk notices
            if (notice.riskLevel === "high") {
                openHighRiskCount++;
                score -= 20; // -20 points per open HIGH RISK notice
                riskFlags.push(
                    `HIGH RISK: ${notice.noticeType ?? "Notice"} from ${notice.authority ?? "Authority"}`
                );
            } else if (notice.riskLevel === "medium") {
                score -= 5; // -5 points per open MEDIUM RISK notice
            }

            // Check for overdue deadlines
            if (notice.deadline) {
                const deadlineDate = new Date(notice.deadline);
                if (deadlineDate < now) {
                    overdueCount++;
                    score -= 15; // -15 additional points for overdue notices
                    riskFlags.push(
                        `OVERDUE: ${notice.noticeType ?? "Notice"} deadline passed on ${notice.deadline}`
                    );
                }
            }
        }

        // Clamp score between 0 and 100
        score = Math.max(0, Math.min(100, score));

        // Settlement blocked if score < 40 or any overdue HIGH RISK notices
        const settlementAllowed = score >= 40 && overdueCount === 0;

        // Update the stored compliance score on the tenant record
        await db
            .update(tenants)
            .set({ complianceScore: score })
            .where(eq(tenants.id, tenantId));

        const riskSummary =
            riskFlags.length > 0
                ? `${riskFlags.length} compliance issue(s) detected: ${riskFlags.slice(0, 3).join("; ")}${riskFlags.length > 3 ? ` (+${riskFlags.length - 3} more)` : ""}`
                : "No compliance issues detected. All notices are within acceptable risk parameters.";

        return NextResponse.json({
            tenantId,
            tenantName: tenant.name,
            complianceScore: score,
            settlementAllowed,
            openHighRiskCount,
            openMediumRiskCount: openNotices.filter((n) => n.riskLevel === "medium").length,
            openNoticeCount: openNotices.length,
            overdueCount,
            riskSummary,
            calculatedAt: new Date().toISOString(),
        });
    } catch (e) {
        console.error("[PineLabs Compliance Health] Error:", e);
        return NextResponse.json(
            { error: "Internal server error calculating compliance score" },
            { status: 500 }
        );
    }
}
