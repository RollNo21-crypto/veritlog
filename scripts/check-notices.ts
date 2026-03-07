import "dotenv/config";
import { db } from "../src/server/db";
import { notices, tenants } from "../src/server/db/schema";

console.log("DATABASE_URL:", process.env.DATABASE_URL?.slice(0, 40) + "...");

const tenantRows = await db.select().from(tenants);
console.log("\n=== TENANTS ===");
console.log(JSON.stringify(tenantRows, null, 2));

const noticeRows = await db
    .select({ id: notices.id, tenantId: notices.tenantId, source: notices.source, status: notices.status, createdAt: notices.createdAt })
    .from(notices);

console.log("\n=== NOTICES ===");
console.log("Total:", noticeRows.length);
console.log(JSON.stringify(noticeRows, null, 2));

process.exit(0);
