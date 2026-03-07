import { db } from "../src/server/db";
import { clients, tenants, notices } from "../src/server/db/schema";
import { eq, and } from "drizzle-orm";

async function runEndToEndTest() {
    const tenantId = "e2e_test_tenant";
    const businessName = "Quantum Dynamics Corp";
    const contactName = "Alice Smith";
    const gstin = "27QUANTUM1234F1";

    // Inject necessary environment variables for AI extraction
    process.env.GEMINI_API_KEY = "AIzaSyApfRPFgzoOXSJuNN6llE2r2oVVBRLTz0c";
    process.env.BEDROCK_API_KEY = "ABSKQmVkcm9ja0FQSUtleS1qdmJoLWF0LTg4NTQ1NzUxOTMxMjpoenRyaDRZWUwxeDgvemVWOEZMcGVMbFQ5NEsrWVprejZTRU9qbjFsYXBrYldLLzlLaHhaVkpsOElEYz0=";
    process.env.S3_BUCKET_NAME = "veritlog-notices-mumbai";
    process.env.AWS_REGION = "ap-south-1";
    process.env.AWS_ACCESS_KEY_ID = "AKIA44KLBQLIBURSZLFU";
    process.env.AWS_SECRET_ACCESS_KEY = "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";

    console.log("🚀 Starting End-to-End Email Flow Test...");

    // 1. Setup Tenant & Client
    await db.insert(tenants).values({
        id: tenantId,
        name: "E2E Test CA",
        plan: "free",
    }).onConflictDoNothing();

    await db.insert(clients).values({
        id: "e2e_client_id",
        tenantId,
        businessName,
        contactName,
        gstin,
    }).onConflictDoNothing();

    console.log(`✅ Setup client: ${businessName}`);

    // Simulate Webhook Ingestion
    // We'll call the logic directly by simulating what the route does
    const { POST } = await import("../src/app/api/webhooks/email/route");

    // Scenario 1: Email WITH PDF Attachment
    console.log("\n📧 Scenario 1: Email with PDF Attachment");
    const payloadWithAttachment = {
        from: "alerts@gst.gov.in",
        to: `notices+${tenantId}@ingest.veritlog.in`,
        subject: "Notice Issued: Quantum Dynamics",
        attachments: [
            {
                name: "notice_123.pdf",
                content: Buffer.from("fake pdf content").toString('base64'),
                content_type: "application/pdf",
                size: 1024
            }
        ]
    };

    const req1 = new Request("http://localhost/api/webhooks/email", {
        method: "POST",
        body: JSON.stringify(payloadWithAttachment)
    });

    const res1 = await POST(req1 as any);
    const data1 = await res1.json();
    console.log("Response 1:", data1);

    // Scenario 2: Email WITHOUT Attachment (Intimation)
    console.log("\n📧 Scenario 2: Intimation Email (No Attachment)");
    const payloadIntimation = {
        from: "no-reply@gstportal.gov.in",
        to: `notices+${tenantId}@ingest.veritlog.in`,
        subject: "Intimation of Notice for Alice Smith",
        text: `Dear Alice Smith, A notice has been issued to your GSTIN ${gstin}. Please log in to the portal.`
    };

    const req2 = new Request("http://localhost/api/webhooks/email", {
        method: "POST",
        body: JSON.stringify(payloadIntimation)
    });

    const res2 = await POST(req2 as any);
    const data2 = await res2.json();
    console.log("Response 2:", data2);

    // 3. Verify Database
    console.log("\n📊 Verifying results in Database...");
    const createdNotices = await db.select().from(notices).where(eq(notices.tenantId, tenantId));

    console.log(`Found ${createdNotices.length} notices for tenant.`);
    for (const notice of createdNotices) {
        console.log(`- Notice: ${notice.fileName} | Status: ${notice.status} | ClientID: ${notice.clientId ? "MATCHED" : "UNMAPPED"}`);
    }

    if (createdNotices.some(n => n.clientId !== null)) {
        console.log("\n🎉 SUCCESS: End-to-end flow verified!");
    } else {
        console.log("\n❌ FAILURE: Mapping failed during E2E test.");
    }
}

runEndToEndTest().catch(console.error);
