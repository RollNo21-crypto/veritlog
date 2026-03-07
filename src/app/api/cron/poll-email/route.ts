import { type NextRequest, NextResponse } from "next/server";
import { pollEmailInbox } from "~/server/services/imap";

// Cron: Poll IMAP inbox for new notice emails
// Schedule: every 15 minutes (vercel.json: schedule "slash-15 star star star star")
// Manual test: GET /api/cron/poll-email?secret=YOUR_CRON_SECRET

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
    const secret = req.headers.get("x-cron-secret") ?? req.nextUrl.searchParams.get("secret");
    if (secret !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = process.env.EMAIL_TENANT_ID ?? "system";

    // Diagnostic: check if IMAP env vars are present
    const imapConfigured = !!(process.env.EMAIL_IMAP_HOST && process.env.EMAIL_IMAP_USER && process.env.EMAIL_IMAP_PASS);

    try {
        console.log("──────────────────────────────────────────────────");
        console.log("🔄 [cron/poll-email] Starting IMAP inbox poll for new notices...");
        console.log(`   tenantId=${tenantId}, imapConfigured=${imapConfigured}`);
        const result = await pollEmailInbox(tenantId);
        console.log(`✨ [cron/poll-email] Poll Complete — Processed: ${result.processed} | Skipped: ${result.skipped} | Failed: ${result.failed}`);
        console.log("──────────────────────────────────────────────────");

        return NextResponse.json({
            ok: true,
            ...result,
            tenantId,
            imapConfigured,
            timestamp: new Date().toISOString(),
        });
    } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        const stack = err instanceof Error ? err.stack : "";
        console.error("🚨 [cron/poll-email] CRITICAL ERROR:", msg);
        return NextResponse.json({ ok: false, error: msg, stack, tenantId, imapConfigured }, { status: 500 });
    }
}
