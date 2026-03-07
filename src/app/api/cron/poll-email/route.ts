import { type NextRequest, NextResponse } from "next/server";
import { pollEmailInbox } from "~/server/services/imap";

// Cron: Poll IMAP inbox for new notice emails
// Schedule: every 15 minutes (vercel.json: schedule "slash-15 star star star star")
// Manual test: GET /api/cron/poll-email?secret=YOUR_CRON_SECRET

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
    const secret = req.headers.get("x-cron-secret") ?? req.nextUrl.searchParams.get("secret");
    if (secret !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = process.env.EMAIL_TENANT_ID ?? "system";

    try {
        console.log("[cron/poll-email] Starting IMAP poll...");
        const result = await pollEmailInbox(tenantId);
        console.log(`[cron/poll-email] Done — processed: ${result.processed}, failed: ${result.failed}, skipped: ${result.skipped}`);

        return NextResponse.json({
            ok: true,
            ...result,
            tenantId,
            timestamp: new Date().toISOString(),
        });
    } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        const stack = err instanceof Error ? err.stack : "";
        console.error("[cron/poll-email] Error:", msg);
        return NextResponse.json({ ok: false, error: msg, stack, tenantId }, { status: 500 });
    }
}
