import { NextResponse } from "next/server";
import { db } from "~/server/db";
import { notices, clients } from "~/server/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { createPaymentOrder } from "~/server/services/pine-labs";

/**
 * POST /api/pine-labs/create-order
 *
 * Creates a real Pine Labs Plural order for a given notice and returns the
 * hosted checkout URL to redirect the customer to.
 *
 * Body: { noticeId: string }
 * Response: { checkoutUrl: string; orderId: string }
 */
export async function POST(req: Request) {
    try {
        const body = (await req.json()) as {
            noticeId?: string;
            customerName?: string;
            customerPhone?: string;
            customerEmail?: string;
            billingAddress1?: string;
            billingCity?: string;
            billingState?: string;
            billingPincode?: string;
        };
        const noticeId = body.noticeId?.trim();

        if (!noticeId) {
            return NextResponse.json(
                { error: "noticeId is required" },
                { status: 400 }
            );
        }

        // ── Look up notice ──────────────────────────────────────────────────
        const [notice] = await db
            .select()
            .from(notices)
            .where(and(eq(notices.id, noticeId), isNull(notices.deletedAt)))
            .limit(1);

        if (!notice) {
            return NextResponse.json({ error: "Notice not found" }, { status: 404 });
        }

        if (notice.status === "closed") {
            return NextResponse.json(
                { error: "This notice has already been paid" },
                { status: 409 }
            );
        }

        if (!notice.amount || notice.amount <= 0) {
            return NextResponse.json(
                { error: "This notice does not have a valid payment amount" },
                { status: 422 }
            );
        }

        // ── Look up client contact details (optional enrichment) ───────────
        let customerEmail: string | undefined;
        let customerPhone: string | undefined;
        let customerName: string | undefined;

        if (notice.clientId) {
            const [client] = await db
                .select({
                    contactEmail: clients.contactEmail,
                    contactPhone: clients.contactPhone,
                    contactName: clients.contactName,
                    businessName: clients.businessName,
                })
                .from(clients)
                .where(eq(clients.id, notice.clientId))
                .limit(1);

            if (client) {
                customerEmail = body.customerEmail || client.contactEmail || undefined;
                customerPhone = body.customerPhone || client.contactPhone || undefined;
                customerName = body.customerName || client.contactName || client.businessName || undefined;
            }
        } else {
            customerEmail = body.customerEmail || undefined;
            customerPhone = body.customerPhone || undefined;
            customerName = body.customerName || undefined;
        }

        // ── Build return & notify URLs ─────────────────────────────────────
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
        const returnUrl = `${appUrl}/api/pine-labs/callback?noticeId=${noticeId}&pl_order_id={order_id}`;
        const notifyUrl = `https://abc-123.ngrok-free.app/api/pine-labs/webhook`;

        // ── Create Pine Labs order ─────────────────────────────────────────
        const result = await createPaymentOrder({
            noticeId,
            amountPaise: notice.amount, // already stored in paise
            description: `Demand notice payment — ${notice.authority ?? "Tax Authority"} (${noticeId.slice(0, 12)})`,
            returnUrl,
            notifyUrl,
            customerEmail,
            customerPhone,
            customerName,
            billingAddress1: body.billingAddress1,
            billingCity: body.billingCity,
            billingState: body.billingState,
            billingPincode: body.billingPincode,
        });

        return NextResponse.json({
            checkoutUrl: result.checkoutUrl,
            orderId: result.orderId,
        });
    } catch (err) {
        console.error("[PineLabs] Create order error:", err);
        const errorMessage = err instanceof Error ? err.message : String(err);

        // Handle Pine Labs UAT unstable server (ReadTimeoutException)
        if (errorMessage.includes("ReadTimeoutException") || errorMessage.includes("500")) {
            return NextResponse.json(
                {
                    error: "Pine Labs UAT server is currently unstable (Timeout). This usually resolves after a few retries. Please try again in 30 seconds."
                },
                { status: 503 }
            );
        }

        return NextResponse.json(
            {
                error: errorMessage || "Failed to create payment order",
            },
            { status: 500 }
        );
    }
}
