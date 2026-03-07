import { db } from "../src/server/db";
import { clients, tenants } from "../src/server/db/schema";
import { eq, and, or, ilike } from "drizzle-orm";
import { extractNoticeData } from "../src/server/services/extraction";

async function verifyMapping() {
    const tenantId = "test_tenant_mapping";
    console.log("🚀 Starting Client Mapping Verification...");

    // 1. Setup Test Tenant & Client
    await db.insert(tenants).values({
        id: tenantId,
        name: "Test Firm",
        plan: "free",
    }).onConflictDoNothing();

    const testClientId = "client_fuzzy_test";
    await db.insert(clients).values({
        id: testClientId,
        tenantId,
        businessName: "Global Logistics Solutions Pvt Ltd",
        contactName: "Rajesh Kumar",
        gstin: "27ABCDE1234F1Z5",
    }).onConflictDoNothing();

    console.log("✅ Test client created: Global Logistics Solutions Pvt Ltd / Rajesh Kumar");

    // 2. Test Case A: Mapping via Business Name (No GSTIN in text)
    const emailA = `
        Dear Global Logistics,
        A notice has been issued to your organization. Please check the portal.
        Regards, GST Dept.
    `;
    console.log("\n🧪 Test Case A: Business Name Only");
    const extractionA = await extractNoticeData(null, "parallel", emailA);
    console.log("🤖 AI Extracted Business Name:", extractionA.data.extractedBusinessName);

    const conditionsA = [];
    if (extractionA.data.extractedGstin) conditionsA.push(eq(clients.gstin, extractionA.data.extractedGstin));
    if (extractionA.data.extractedBusinessName) conditionsA.push(ilike(clients.businessName, `%${extractionA.data.extractedBusinessName}%`));

    const matchA = await db.select().from(clients).where(
        and(eq(clients.tenantId, tenantId), or(...conditionsA))
    ).limit(1);

    if (matchA[0]?.id === testClientId) {
        console.log("🎉 SUCCESS: Mapped to client via Business Name!");
    } else {
        console.log("❌ FAILURE: Could not map via Business Name.");
    }

    // 3. Test Case B: Mapping via Contact Person (No GSTIN or Org Name in text)
    const emailB = `
        To Mr. Rajesh Kumar,
        This is an intimation regarding your tax filing status.
        Please acknowledge receipt.
    `;
    console.log("\n🧪 Test Case B: Contact Name Only");
    const extractionB = await extractNoticeData(null, "parallel", emailB);
    console.log("🤖 AI Extracted Contact Name:", extractionB.data.extractedContactName);

    const conditionsB = [];
    if (extractionB.data.extractedContactName) conditionsB.push(ilike(clients.contactName, `%${extractionB.data.extractedContactName}%`));

    const matchB = await db.select().from(clients).where(
        and(eq(clients.tenantId, tenantId), or(...conditionsB))
    ).limit(1);

    if (matchB[0]?.id === testClientId) {
        console.log("🎉 SUCCESS: Mapped to client via Contact Person!");
    } else {
        console.log("❌ FAILURE: Could not map via Contact Person.");
    }
}

verifyMapping().catch(console.error);
