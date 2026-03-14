import { NextResponse } from "next/server";
import { db } from "~/server/db";
import { notices, auditLogs, payments } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { getOrderStatus } from "~/server/services/pine-labs";

/**
 * GET /api/pine-labs/verify
 *
 * Securely verifies the status of a Pine Labs order synchronously.
 * Used when the customer returns from the hosted checkout.
 *
 * Query: ?orderId=string&noticeId=string
 * Response: { status: "SUCCESS" | "FAILED" | "PENDING" }
 */
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get("orderId");
    const noticeId = searchParams.get("noticeId");

    if (!orderId || !noticeId) {
        return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    try {
        // Fetch actual status from Pine Labs
        const pluralOrder = await getOrderStatus(orderId);

        // merchantOrderReference has a timestamp appended to make it unique per retry
        // Format: notice_time_rand_1234567890123. We strip the 13-digit timestamp at the end.
        const refNoticeId = pluralOrder.merchantOrderReference?.replace(/_\d{13}$/, "");

        // Verify the order actually belongs to this notice
        if (refNoticeId !== noticeId) {
            console.warn(`[PineLabs Verify] Order ${orderId} does not match notice ${noticeId}`);
            return NextResponse.json({ error: "Order reference mismatch" }, { status: 400 });
        }

        const status = (pluralOrder.status || "").toUpperCase();

        if (status === "CHARGED" || status === "SUCCESS" || status === "PAYMENT_SUCCESSFUL") {
            // Close the notice and record payment in a transaction
            await db.transaction(async (tx) => {
                const [notice] = await tx
                    .select()
                    .from(notices)
                    .where(eq(notices.id, noticeId))
                    .limit(1);

                if (!notice) return;

                // 1. Mark notice as closed (idempotent)
                if (notice.status !== "closed") {
                    await tx
                        .update(notices)
                        .set({
                            status: "closed",
                            closedAt: new Date(),
                            closedBy: "PINE_LABS_SYNC",
                            updatedAt: new Date(),
                        })
                        .where(eq(notices.id, noticeId));
                }

                // 2. Check if payment record already exists (idempotency)
                const [existingPayment] = await tx
                    .select()
                    .from(payments)
                    .where(eq(payments.orderId, orderId))
                    .limit(1);

                if (!existingPayment) {
                    // Record detailed payment
                    const paymentId = `pay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                    await tx.insert(payments).values({
                        id: paymentId,
                        noticeId,
                        tenantId: notice.tenantId,
                        orderId: orderId,
                        amount: pluralOrder.amountPaise || 0,
                        status: status,
                        paymentMethod: pluralOrder.payment_info?.payment_mode || "Sync Verification",
                        rawResponse: pluralOrder,
                        createdAt: new Date(),
                    });

                    // 3. Immutable audit trail entry
                    const auditId = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                    await tx.insert(auditLogs).values({
                        id: auditId,
                        tenantId: notice.tenantId,
                        userId: "PINE_LABS_SYNC",
                        action: "payment.recorded",
                        entityType: "payment",
                        entityId: paymentId,
                        newValue: JSON.stringify({
                            noticeId,
                            status: "closed",
                            paymentMethod: pluralOrder.payment_info?.payment_mode || "Pine Labs Plural",
                            pluralOrderId: orderId,
                            settlementStatus: status,
                            amountPaid: `₹${((pluralOrder.amountPaise || 0) / 100).toLocaleString("en-IN")}`,
                            verifiedVia: "sync_return",
                            processedAt: new Date().toISOString(),
                        }),
                        createdAt: new Date(),
                    });
                }
            });

            return NextResponse.json({ status: "SUCCESS" });
        } else if (status === "FAILED" || status === "CANCELLED" || status === "PAYMENT_FAILED") {
            return NextResponse.json({ status: "FAILED" });
        } else {
            return NextResponse.json({ status: "PENDING" });
        }
    } catch (err) {
        console.error("[PineLabs Verify] Error verifying order:", err);
        return NextResponse.json(
            { error: "Failed to verify order status" },
            { status: 500 }
        );
    }
}
