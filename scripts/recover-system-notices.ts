import { db } from "../src/server/db";
import { notices } from "../src/server/db/schema";
import { eq } from "drizzle-orm";

async function recoverNotices() {
    const targetTenantId = "user_39xltCPscXXLj4JyQpR0HvlZhpo";
    console.log(`🛠️ Recovering notices from 'system' to '${targetTenantId}'...`);

    const orphaned = await db.select().from(notices).where(eq(notices.tenantId, "system"));
    console.log(`Found ${orphaned.length} orphaned notices.`);

    for (const notice of orphaned) {
        console.log(`🚀 Moving notice: ${notice.id} (${notice.fileName})`);
        await db.update(notices)
            .set({ tenantId: targetTenantId })
            .where(eq(notices.id, notice.id));
    }

    console.log("✅ Recovery complete.");
}

recoverNotices().catch(console.error);
