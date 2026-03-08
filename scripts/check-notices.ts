import "dotenv/config";
import { db } from "../src/server/db";
import { notices } from "../src/server/db/schema";

async function main() {
    const rows = await db.select({
        id: notices.id,
        status: notices.status,
        authority: notices.authority,
        tenantId: notices.tenantId,
        source: notices.source,
        fileName: notices.fileName,
        createdAt: notices.createdAt,
    }).from(notices).limit(20);

    if (rows.length === 0) {
        console.log("❌ No notices found in DB!");
    } else {
        console.log(`✅ Found ${rows.length} notices in DB:`);
        rows.forEach((r, i) => {
            console.log(`${i + 1}. [${r.status}] ${r.fileName} | tenantId=${r.tenantId} | source=${r.source} | id=${r.id}`);
        });
    }
    process.exit(0);
}
main();
