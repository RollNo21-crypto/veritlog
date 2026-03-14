/**
 * Pine Labs Plural Payment Gateway Service
 *
 * Wraps the Plural API v2 with:
 * - Token generation & caching (tokens last 15 min)
 * - Order creation → returns hosted checkout URL
 * - Webhook signature verification
 *
 * UAT base: https://pluraluat.v2.pinepg.in
 * Prod base: https://api.pluralpay.in
 */

import crypto from "crypto";

// ── Config ───────────────────────────────────────────────────────────────────
const IS_UAT = (process.env.PINE_LABS_ENV ?? "uat") !== "production";
const BASE_URL = IS_UAT
    ? "https://pluraluat.v2.pinepg.in"
    : "https://api.pluralpay.in";

const CLIENT_ID = process.env.PINE_LABS_CLIENT_ID!;
const CLIENT_SECRET = process.env.PINE_LABS_CLIENT_SECRET!;

// ── Token Cache ──────────────────────────────────────────────────────────────
let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Generate (or return cached) Plural OAuth2 access token.
 * Tokens are valid for 15 minutes; we refresh 60 seconds early.
 */
export async function getAccessToken(): Promise<string> {
    const now = Date.now();
    if (cachedToken && cachedToken.expiresAt > now + 60_000) {
        return cachedToken.token;
    }

    const url = `${BASE_URL}/api/auth/v1/token`;

    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            grant_type: "client_credentials",
        }),
    });

    if (!res.ok) {
        const body = await res.text();
        throw new Error(`[PineLabs] Token fetch failed (${res.status}): ${body}`);
    }

    const data = (await res.json()) as {
        access_token: string;
        expires_in: number; // seconds
    };

    cachedToken = {
        token: data.access_token,
        // expires_in is in seconds; convert to ms
        expiresAt: now + data.expires_in * 1_000,
    };

    return cachedToken.token;
}

// ── Types ────────────────────────────────────────────────────────────────────
export interface CreateOrderParams {
    noticeId: string;          // used as merchant_order_reference
    amountPaise: number;       // amount in paise (e.g. ₹500 = 50000)
    description: string;       // short description shown on checkout
    returnUrl: string;         // where Plural redirects after payment
    notifyUrl: string;         // your webhook URL for async events
    customerEmail?: string;
    customerPhone?: string;
    customerName?: string;
    billingAddress1?: string;
    billingPincode?: string;
    billingCity?: string;
    billingState?: string;
}

export interface CreateOrderResult {
    orderId: string;           // Plural's order_id
    checkoutUrl: string;       // redirect the customer here
}

/**
 * Create a Plural order and return the hosted checkout URL.
 *
 * Plural flow:
 * 1. POST /api/checkout/v1/orders  →  { order_id, redirect_url }
 */
export async function createPaymentOrder(
    params: CreateOrderParams
): Promise<CreateOrderResult> {
    const token = await getAccessToken();
    const url = `${BASE_URL}/api/checkout/v1/orders`;

    const nameParts = (params.customerName || "Client").trim().split(/\s+/);
    const firstName = nameParts[0] || "Client";
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "User";

    // Make the merchant_order_reference unique for retries
    const uniqueOrderRef = `${params.noticeId}_${Date.now()}`;

    const payload = {
        merchant_order_reference: uniqueOrderRef,
        order_amount: {
            value: params.amountPaise,
            currency: "INR",
        },
        pre_auth: false,
        purchase_details: {
            customer: {
                email_id: (params.customerEmail || "customer@veritlog.in").trim().substring(0, 50),
                first_name: firstName.substring(0, 30),
                last_name: lastName.substring(0, 30),
                mobile_number: (params.customerPhone || "9999999999").replace(/\D/g, "").slice(-10).padEnd(10, '9'),
                billing_address: {
                    address1: (params.billingAddress1 || "India").trim().substring(0, 50),
                    pincode: (params.billingPincode || "110001").trim().substring(0, 6),
                    city: (params.billingCity || "New Delhi").trim().substring(0, 30),
                    state: (params.billingState || "Delhi").trim().substring(0, 30),
                    country: "IN",
                },
                shipping_address: {
                    address1: (params.billingAddress1 || "India").trim().substring(0, 50),
                    pincode: (params.billingPincode || "110001").trim().substring(0, 6),
                    city: (params.billingCity || "New Delhi").trim().substring(0, 30),
                    state: (params.billingState || "Delhi").trim().substring(0, 30),
                    country: "IN",
                },
            },
            merchant_metadata: {
                key1: params.noticeId,
                key2: "veritlog-notice-payment",
            },
        },
        // Where to redirect after checkout
        callback_url: params.returnUrl,
    };

    const res = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            "Request-ID": `req_test_${Date.now()}`,
            "Request-Timestamp": new Date().toISOString(),
        },
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        const body = await res.text();
        throw new Error(`[PineLabs] Create order failed (${res.status}): ${body}`);
    }

    const data = (await res.json()) as {
        order_id: string;
        redirect_url: string;
    };

    return {
        orderId: data.order_id,
        checkoutUrl: data.redirect_url,
    };
}

/**
 * Verify webhook HMAC-SHA256 signature from Pine Labs.
 *
 * Pine Labs sends X-Verify: HMAC-SHA256(rawBody, clientSecret)
 */
export function verifyWebhookSignature(
    rawBody: string,
    receivedSignature: string
): boolean {
    try {
        const expectedSignature = crypto
            .createHmac("sha256", CLIENT_SECRET)
            .update(rawBody)
            .digest("hex");

        return crypto.timingSafeEqual(
            Buffer.from(expectedSignature, "hex"),
            Buffer.from(receivedSignature, "hex")
        );
    } catch {
        return false;
    }
}

/**
 * Fetch the status of an existing Plural order.
 * Used to verify payment server-side on the return URL (prevent replay attacks).
 */
export async function getOrderStatus(orderId: string): Promise<{
    status: string;
    merchantOrderReference: string;
    amountPaise: number;
    payment_info?: {
        payment_mode?: string;
    };
    [key: string]: any; // Allow capturing full response
}> {
    const token = await getAccessToken();
    const url = `${BASE_URL}/api/checkout/v1/orders/${orderId}`;

    const res = await fetch(url, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    if (!res.ok) {
        const body = await res.text();
        throw new Error(`[PineLabs] Get order status failed (${res.status}): ${body}`);
    }

    const data = (await res.json()) as any;

    // ── Diagnostic: log full raw response to identify exact status field ───
    console.log(`[PineLabs] getOrderStatus raw response for ${orderId}:`, JSON.stringify({
        status: data.status,
        order_id: data.order_id,
        merchant_order_reference: data.merchant_order_reference,
        order_amount: data.order_amount,
        payment_info: data.payment_info,
    }));

    return {
        ...data,
        status: data.status,
        merchantOrderReference: data.merchant_order_reference,
        amountPaise: data.order_amount?.value ?? 0,
        payment_info: data.payment_info,
    };
}
