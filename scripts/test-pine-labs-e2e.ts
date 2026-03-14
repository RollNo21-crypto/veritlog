/**
 * Pine Labs Plural End-to-End Integration Test
 *
 * Tests:
 * 1. Token generation (UAT credentials → real API call)
 * 2. Create order (with a test notice ID and amount)
 * 3. Webhook signature verification (HMAC-SHA256)
 * 4. Webhook handler via the local dev server (/api/pine-labs/webhook)
 * 5. Create-order handler via local dev server (/api/pine-labs/create-order)
 *
 * Run: npx ts-node --project tsconfig.json /tmp/test-pine-labs.ts
 * (Dev server must be running on localhost:3000)
 */

import crypto from "crypto";

const BASE_APP_URL = "http://localhost:3000";
const PINE_LABS_CLIENT_ID = "5c788512-1ff9-48ab-8a5d-e2279fd150c8";
const PINE_LABS_CLIENT_SECRET = "f9945c707a83441b966ffa48d961e5f1";
const PINE_LABS_TOKEN_URL = "https://pluraluat.v2.pinepg.in/api/auth/v1/token";
const PINE_LABS_ORDER_URL = "https://pluraluat.v2.pinepg.in/api/checkout/v1/orders";
const WEBHOOK_SECRET = "pine-labs-local-secret-2026-v3rtlg";

let passed = 0;
let failed = 0;

function log(label: string, ok: boolean, detail?: string) {
    const icon = ok ? "✅" : "❌";
    const status = ok ? "PASS" : "FAIL";
    console.log(`${icon} [${status}] ${label}`);
    if (detail) console.log(`        ${detail}`);
    ok ? passed++ : failed++;
}

// ── Test 1: Pine Labs Token Generation ───────────────────────────────────────
async function testTokenGeneration() {
    console.log("\n━━━ Test 1: Pine Labs Token Generation (UAT) ━━━");
    try {
        const res = await fetch(PINE_LABS_TOKEN_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                client_id: PINE_LABS_CLIENT_ID,
                client_secret: PINE_LABS_CLIENT_SECRET,
                grant_type: "client_credentials",
            }),
        });

        const data = await res.json() as Record<string, unknown>;

        if (res.ok && data.access_token) {
            log(
                "Token generated successfully",
                true,
                `access_token: ${String(data.access_token).slice(0, 40)}..., expires_in: ${data.expires_in}s`
            );
            return data.access_token as string;
        } else {
            log("Token generation", false, `HTTP ${res.status}: ${JSON.stringify(data)}`);
            return null;
        }
    } catch (err) {
        log("Token generation (network)", false, String(err));
        return null;
    }
}

// ── Test 2: Create Order (UAT) ────────────────────────────────────────────────
async function testCreateOrder(token: string) {
    console.log("\n━━━ Test 2: Create Order (Pine Labs UAT) ━━━");

    const testNoticeId = `notice_test_${Date.now()}`;
    const amountPaise = 50000; // ₹500

    try {
        const payload = {
            merchant_order_reference: testNoticeId,
            order_amount: { value: amountPaise, currency: "INR" },
            pre_auth: false,
            purchase_details: {
                customer: {
                    email_id: "test@veritlog.in",
                    first_name: "Test",
                    last_name: "Client",
                    mobile_number: "9999999999",
                    billing_address: {
                        address1: "India",
                        pincode: "110001",
                        city: "New Delhi",
                        state: "Delhi",
                        country: "IN",
                    },
                    shipping_address: {
                        address1: "India",
                        pincode: "110001",
                        city: "New Delhi",
                        state: "Delhi",
                        country: "IN",
                    },
                },
                merchant_metadata: { key1: testNoticeId, key2: "veritlog-test" },
            },
            callback_url: `${BASE_APP_URL}/pay/${testNoticeId}?pl_status=SUCCESS&pl_order_id={order_id}`,
        };

        const res = await fetch(PINE_LABS_ORDER_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
                "Request-ID": `req_test_${Date.now()}`,
                "Request-Timestamp": new Date().toISOString(),
            },
            body: JSON.stringify(payload),
        });

        const data = await res.json() as Record<string, unknown>;

        if (res.ok && data.redirect_url) {
            log(
                "Order created successfully",
                true,
                `order_id: ${data.order_id}\n        redirect_url: ${String(data.redirect_url).slice(0, 80)}...`
            );
            return { orderId: data.order_id as string, checkoutUrl: data.redirect_url as string };
        } else {
            log("Create order", false, `HTTP ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
            return null;
        }
    } catch (err) {
        log("Create order (network)", false, String(err));
        return null;
    }
}

// ── Test 3: Webhook Signature Verification ────────────────────────────────────
async function testWebhookSignature() {
    console.log("\n━━━ Test 3: Webhook Signature Verification ━━━");

    const fakePayload = JSON.stringify({
        status: "CHARGED",
        merchant_order_reference: "notice_test_abc123",
        order_id: "pl_order_xyz",
        order_amount: { value: 50000, currency: "INR" },
    });

    // Generate valid HMAC signature (Pine Labs signs with client_secret)
    const validSig = crypto
        .createHmac("sha256", PINE_LABS_CLIENT_SECRET)
        .update(fakePayload)
        .digest("hex");

    log("Signature computation", true, `HMAC-SHA256: ${validSig.slice(0, 32)}...`);

    // Test: POST to our webhook with valid signature (expect 200 — notice not in DB = skip gracefully)
    try {
        const res = await fetch(`${BASE_APP_URL}/api/pine-labs/webhook`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-verify": validSig,
            },
            body: fakePayload,
        });

        const data = await res.json() as Record<string, unknown>;

        if (res.status === 200) {
            log(
                "Webhook with valid signature accepted",
                true,
                `Response: ${JSON.stringify(data)}`
            );
        } else {
            log("Webhook with valid signature", false, `HTTP ${res.status}: ${JSON.stringify(data)}`);
        }
    } catch (err) {
        log("Webhook endpoint (network)", false, String(err));
    }

    // Test: POST with INVALID signature (expect 401)
    try {
        const res = await fetch(`${BASE_APP_URL}/api/pine-labs/webhook`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-verify": "badbadbadbad",
            },
            body: fakePayload,
        });

        if (res.status === 401) {
            log("Webhook with invalid signature rejected (401)", true);
        } else {
            const data = await res.json() as Record<string, unknown>;
            log("Webhook invalid sig should be 401", false, `Got HTTP ${res.status}: ${JSON.stringify(data)}`);
        }
    } catch (err) {
        log("Webhook invalid signature test (network)", false, String(err));
    }
}

// ── Test 4: Local create-order API route through dev server ──────────────────
async function testLocalCreateOrderRoute() {
    console.log("\n━━━ Test 4: /api/pine-labs/create-order (dev server) ━━━");

    // Test with missing noticeId — should 400
    try {
        const res = await fetch(`${BASE_APP_URL}/api/pine-labs/create-order`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
        });

        if (res.status === 400) {
            log("Missing noticeId returns 400", true);
        } else {
            log("Missing noticeId should return 400", false, `Got ${res.status}`);
        }
    } catch (err) {
        log("create-order 400 test (network)", false, String(err));
    }

    // Test with non-existent notice — should 404
    try {
        const res = await fetch(`${BASE_APP_URL}/api/pine-labs/create-order`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ noticeId: "notice_does_not_exist_abc999" }),
        });

        if (res.status === 404) {
            log("Non-existent noticeId returns 404", true);
        } else {
            const data = await res.json() as Record<string, unknown>;
            log("Non-existent noticeId should return 404", false, `Got ${res.status}: ${JSON.stringify(data).slice(0, 200)}`);
        }
    } catch (err) {
        log("create-order 404 test (network)", false, String(err));
    }
}

// ── Test 5: Compliance Health API ─────────────────────────────────────────────
async function testComplianceHealth() {
    console.log("\n━━━ Test 5: /api/pine-labs/compliance-health (existing) ━━━");

    try {
        const res = await fetch(`${BASE_APP_URL}/api/pine-labs/compliance-health`, {
            headers: {
                Authorization: `Bearer ${WEBHOOK_SECRET}`,
            },
        });

        if (res.status === 400) {
            // Missing tenant_id — expected
            log("Compliance health endpoint reachable (missing tenant_id = 400)", true);
        } else if (res.status === 200 || res.status === 404) {
            log("Compliance health endpoint reachable", true, `Status: ${res.status}`);
        } else {
            log("Compliance health endpoint", false, `Unexpected status: ${res.status}`);
        }
    } catch (err) {
        log("Compliance health (network)", false, String(err));
    }
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
    console.log("═══════════════════════════════════════════════════════");
    console.log("  VERITLOG × PINE LABS — END-TO-END INTEGRATION TEST");
    console.log(`  Time: ${new Date().toISOString()}`);
    console.log(`  App: ${BASE_APP_URL}`);
    console.log(`  Pine Labs env: UAT`);
    console.log("═══════════════════════════════════════════════════════");

    // Test 1: Real Pine Labs token
    const token = await testTokenGeneration();

    // Test 2: Real Pine Labs order (only if token was obtained)
    if (token) {
        const order = await testCreateOrder(token);
        if (order) {
            console.log("\n  ✨ CHECKOUT URL (open this in browser to test payment UI):");
            console.log(`  ${order.checkoutUrl}`);
        }
    } else {
        console.log("\n  ⚠️  Skipping order creation — token not available");
        failed++;
    }

    // Test 3: Webhook signature + local handler
    await testWebhookSignature();

    // Test 4: Local API routes
    await testLocalCreateOrderRoute();

    // Test 5: Compliance health
    await testComplianceHealth();

    // ── Summary ────────────────────────────────────────────────────────────
    console.log("\n═══════════════════════════════════════════════════════");
    console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
    console.log("═══════════════════════════════════════════════════════\n");

    process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
    console.error("Fatal test error:", err);
    process.exit(1);
});
