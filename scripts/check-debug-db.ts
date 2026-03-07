import { db } from "../src/server/db";
import { notices, clients, tenants } from "../src/server/db/schema";
import { count, eq } from "drizzle-orm";

async function checkDb() {
    console.log("🔍 Checking Database State...");

    const noticeCount = await db.select({ value: count() }).from(notices);
    console.log(`- Total Notices: ${noticeCount[0].value}`);

    const clientCount = await db.select({ value: count() }).from(clients);
    console.log(`- Total Clients: ${clientCount[0].value}`);

    const tenantId = process.env.EMAIL_TENANT_ID || "system";
    console.log(`- Configured EMAIL_TENANT_ID: ${tenantId}`);

    const clientsForTenant = await db.select().from(clients).where(eq(clients.tenantId, tenantId));
    console.log(`- Clients for this Tenant: ${clientsForTenant.length}`);
    for (const c of clientsForTenant) {
        console.log(`  - ${c.businessName} (GSTIN: ${c.gstin})`);
    }

    const latestNotices = await db.select({
        id: notices.id,
        createdAt: notices.createdAt,
        fileName: notices.fileName,
        status: notices.status,
        tenantId: notices.tenantId,
        clientId: notices.clientId,
        clientName: clients.businessName
    }).from(notices)
        .leftJoin(clients, eq(notices.clientId, clients.id))
        .orderBy(notices.createdAt)
        .limit(5);

    console.log("\n- Latest 5 Notices:");
    for (const n of latestNotices) {
        console.log(`  - [${n.createdAt.toISOString()}] ${n.fileName || 'Untitled'} | Status: ${n.status} | Tenant: ${n.tenantId} | Client: ${n.clientName || 'UNMAPPED'} (${n.clientId || 'none'})`);
    }
}

checkDb().catch(console.error);
