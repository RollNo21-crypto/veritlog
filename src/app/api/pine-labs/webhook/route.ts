import { NextResponse } from "next/server";
import { db } from "~/server/db";
import { notices, auditLogs, payments } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { verifyWebhookSignature } from "~/server/services/pine-labs";

/**
 * POST /api/pine-labs/webhook
 *
 * Receives async payment event notifications from Pine Labs Plural.
 * Called after customer completes (or abandons) checkout.
 *
 * Security:
 *  - Verifies X-Verify HMAC-SHA256 signature using PINE_LABS_CLIENT_SECRET
 *  - Falls back to PINE_LABS_WEBHOOK_SECRET ENV as secondary check
 *
 * On `CHARGED` (payment success):
 *  - Marks the notice as "closed"
 *  - Records detailed payment info in the `payments` table
 *  - Inserts an immutable audit log entry
 */
export async function POST(req: Request) {
    let rawBody: string;

    try {
        rawBody = await req.text();
    } catch {
        return NextResponse.json({ error: "Failed to read body" }, { status: 400 });
    }

    // ── Webhook Signature Verification ────────────────────────────────────────
    const receivedSig = req.headers.get("x-verify") ?? "";

    // Pine Labs uses HMAC-SHA256 of raw body with client secret
    if (receivedSig && !verifyWebhookSignature(rawBody, receivedSig)) {
        console.warn("[PineLabs Webhook] Invalid signature — rejecting");
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // ── Parse Event ──────────────────────────────────────────────────────────
    let event: any;
    try {
        event = JSON.parse(rawBody);
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    console.log("[PineLabs Webhook] Received event:", JSON.stringify(event).slice(0, 500));

    // Extract key fields — Plural sends these at the top level
    const orderStatus = (event.status as string | undefined)?.toUpperCase();
    const merchantOrderRef = event.merchant_order_reference as string | undefined;
    const orderId = event.order_id as string | undefined;
    const amountPaise = (event.order_amount as { value?: number } | undefined)?.value ?? 0;
    const paymentMethod = event.payment_info?.payment_mode as string | undefined;

    // merchant_order_reference has a timestamp appended to make it unique per retry
    // Format: notice_time_rand_1234567890123. We strip the 13-digit timestamp at the end.
    const noticeId = merchantOrderRef?.replace(/_\d{13}$/, "");

    if (!noticeId) {
        console.warn("[PineLabs Webhook] No merchant_order_reference found in event");
        // Return 200 to prevent Pine Labs from retrying (we can't process this)
        return NextResponse.json({ received: true });
    }

    // ── Handle Payment Success ────────────────────────────────────────────────
    if (orderStatus === "CHARGED" || orderStatus === "SUCCESS" || orderStatus === "PAYMENT_SUCCESSFUL") {
        try {
            await db.transaction(async (tx) => {
                const [notice] = await tx
                    .select({ id: notices.id, tenantId: notices.tenantId, amount: notices.amount, status: notices.status })
                    .from(notices)
                    .where(eq(notices.id, noticeId))
                    .limit(1);

                if (!notice) {
                    console.warn(`[PineLabs Webhook] Notice not found: ${noticeId}`);
                    return;
                }

                // Marks notice as closed (idempotent)
                if (notice.status !== "closed") {
                    await tx
                        .update(notices)
                        .set({
                            status: "closed",
                            closedAt: new Date(),
                            closedBy: "PINE_LABS_GATEWAY",
                            updatedAt: new Date(),
                        })
                        .where(eq(notices.id, noticeId));
                }

                // Record the detailed payment record
                const paymentId = `pay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                await tx.insert(payments).values({
                    id: paymentId,
                    noticeId,
                    tenantId: notice.tenantId,
                    orderId: orderId ?? "N/A",
                    amount: amountPaise,
                    status: orderStatus,
                    paymentMethod: paymentMethod ?? "Gateway Redirect",
                    rawResponse: event,
                    createdAt: new Date(),
                });

                // Immutable audit trail entry
                const auditId = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                await tx.insert(auditLogs).values({
                    id: auditId,
                    tenantId: notice.tenantId,
                    userId: "PINE_LABS_GATEWAY",
                    action: "payment.recorded",
                    entityType: "payment",
                    entityId: paymentId,
                    newValue: JSON.stringify({
                        noticeId,
                        status: "closed",
                        paymentMethod: paymentMethod ?? "Pine Labs Plural",
                        pluralOrderId: orderId,
                        settlementStatus: "CHARGED",
                        amountPaid: `₹${(amountPaise / 100).toLocaleString("en-IN")}`,
                        processedAt: new Date().toISOString(),
                    }),
                    createdAt: new Date(),
                });

                console.log(`[PineLabs Webhook] ✅ Notice ${noticeId} closed and payment recorded (order: ${orderId})`);
            });
        } catch (err) {
            console.error("[PineLabs Webhook] DB error:", err);
            // Return 500 so Pine Labs retries the webhook
            return NextResponse.json({ error: "Internal error" }, { status: 500 });
        }
    } else if (orderStatus === "FAILED" || orderStatus === "CANCELLED" || orderStatus === "PAYMENT_FAILED") {
        console.log(`[PineLabs Webhook] ❌ Payment failed/cancelled for notice: ${noticeId}, status: ${orderStatus}`);
    } else {
        console.log(`[PineLabs Webhook] ℹ️ Unhandled status "${orderStatus}" for notice: ${noticeId}`);
    }

    // Always return 200 to acknowledge receipt
    return NextResponse.json({ received: true, noticeId });
}
