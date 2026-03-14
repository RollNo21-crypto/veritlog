import { type NextRequest, NextResponse } from "next/server";
import { getOrderStatus } from "~/server/services/pine-labs";
import { db } from "~/server/db";
import { notices, payments, auditLogs, comments } from "~/server/db/schema";
import { eq } from "drizzle-orm";

/**
 * GET/POST /api/pine-labs/callback
 * 
 * Pine Labs redirects back to this URL after payment. 
 * We synchronously verify the payment server-side and immediately update the DB.
 * If successful, we redirect directly to the Audit Report to prevent the UI from showing.
 */
export async function POST(req: NextRequest) {
    return handleCallback(req);
}

export async function GET(req: NextRequest) {
    return handleCallback(req);
}

async function handleCallback(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    let noticeId = searchParams.get("noticeId");
    let plOrderId = searchParams.get("pl_order_id");

    // If the URL contains the literal string "{order_id}", ignore it so we read from body
    if (plOrderId === "{order_id}") {
        plOrderId = null;
    }

    // Extract from body if POST (from form-data)
    if (req.method === "POST") {
        try {
            const formData = await req.formData();
            plOrderId = plOrderId || (formData.get("pl_order_id") as string) || (formData.get("order_id") as string);
            noticeId = noticeId || (formData.get("noticeId") as string);
        } catch {
            // Not form data
        }
    }

    console.log(`[PineLabs Callback] ▶ method=${req.method}, url=${req.nextUrl.href}`);
    console.log(`[PineLabs Callback] ▶ Parsed: noticeId=${noticeId}, plOrderId=${plOrderId}`);

    if (!noticeId) {
        return new NextResponse("Notice ID missing in callback", { status: 400 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    if (!plOrderId) {
        console.warn(`[PineLabs Callback] ⚠ No plOrderId found — redirecting to dashboard`);
        return NextResponse.redirect(`${appUrl}/dashboard/verify/${noticeId}`, 303);
    }

    try {
        // Fetch actual status from Pine Labs
        const pluralOrder = await getOrderStatus(plOrderId);

        // ── Diagnostic Logging ─────────────────────────────────────────────
        console.log(`[PineLabs Callback] ▶ orderId=${plOrderId}, noticeId=${noticeId}`);
        console.log(`[PineLabs Callback] ▶ Raw API response:`, JSON.stringify({
            status: pluralOrder.status,
            merchantOrderReference: pluralOrder.merchantOrderReference,
            amountPaise: pluralOrder.amountPaise,
            payment_info: pluralOrder.payment_info,
        }));

        // Strip timestamp from unique merchant order ref
        const refNoticeId = pluralOrder.merchantOrderReference?.replace(/_\d{13}$/, "");
        console.log(`[PineLabs Callback] ▶ refNoticeId=${refNoticeId}, expected noticeId=${noticeId}, match=${refNoticeId === noticeId}`);

        if (refNoticeId !== noticeId) {
            console.warn(`[PineLabs Callback] Order ${plOrderId} does not match notice ${noticeId}`);
            return NextResponse.redirect(`${appUrl}/dashboard/verify/${noticeId}`, 303);
        }

        const status = (pluralOrder.status || "").toUpperCase();
        console.log(`[PineLabs Callback] ▶ Final status="${status}", will close=${["CHARGED", "SUCCESS", "PAYMENT_SUCCESSFUL"].includes(status)}`);


        if (status === "CHARGED" || status === "SUCCESS" || status === "PAYMENT_SUCCESSFUL") {
            // Close the notice and record payment in a transaction
            await db.transaction(async (tx) => {
                const [notice] = await tx
                    .select()
                    .from(notices)
                    .where(eq(notices.id, noticeId as string))
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
                        .where(eq(notices.id, noticeId as string));
                }

                // 2. Check if payment record already exists (idempotency)
                const [existingPayment] = await tx
                    .select()
                    .from(payments)
                    .where(eq(payments.orderId, plOrderId as string))
                    .limit(1);

                if (!existingPayment) {
                    // Record detailed payment
                    const paymentId = `pay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                    await tx.insert(payments).values({
                        id: paymentId,
                        noticeId: noticeId as string,
                        tenantId: notice.tenantId,
                        orderId: plOrderId as string,
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
                            noticeId: noticeId as string,
                            status: "closed",
                            paymentMethod: pluralOrder.payment_info?.payment_mode || "Pine Labs Plural",
                            pluralOrderId: plOrderId as string,
                            settlementStatus: status,
                            amountPaid: `₹${((pluralOrder.amountPaise || 0) / 100).toLocaleString("en-IN")}`,
                            verifiedVia: "sync_return",
                            processedAt: new Date().toISOString(),
                        }),
                        createdAt: new Date(),
                    });
                    // 4. Add a visible system comment with payment reference for record-keeping
                    const commentId = `cmt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                    const amountFormatted = `₹${((pluralOrder.amountPaise || 0) / 100).toLocaleString("en-IN")}`;
                    const method = pluralOrder.payment_info?.payment_mode ?? "Pine Labs Plural";
                    await tx.insert(comments).values({
                        id: commentId,
                        noticeId: noticeId as string,
                        tenantId: notice.tenantId,
                        userId: "PINE_LABS_SYNC",
                        content: `✅ Payment received and confirmed via Pine Labs.\n\n` +
                            `• Amount: ${amountFormatted}\n` +
                            `• Method: ${method}\n` +
                            `• Pine Labs Order Ref: ${plOrderId}\n` +
                            `• Processed: ${new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}\n\n` +
                            `Notice has been automatically closed. Audit report is available.`,
                        summary: `Payment of ${amountFormatted} confirmed via Pine Labs (Ref: ${plOrderId})`,
                        createdAt: new Date(),
                    });
                }
            });

            // 🔥 Directly redirect to the Audit Report and bypass the frontend UI completely
            return NextResponse.redirect(`${appUrl}/api/notice/${noticeId}/audit-report`, 303);

        } else {
            // Payment failed or pending -> send user to the notice detail page
            return NextResponse.redirect(`${appUrl}/dashboard/verify/${noticeId}`, 303);
        }
    } catch (err) {
        console.error("[PineLabs Callback] Error verifying order:", err);
        return NextResponse.redirect(`${appUrl}/dashboard/verify/${noticeId}`, 303);
    }
}
