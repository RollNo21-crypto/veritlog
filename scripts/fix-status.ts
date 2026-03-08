import "dotenv/config";
import { db } from "../src/server/db";
import { notices } from "../src/server/db/schema";
import { eq } from "drizzle-orm";

async function main() {
    const updated = await db.update(notices)
        .set({ status: "review_needed", updatedAt: new Date() })
        .where(eq(notices.status, "processing"))
        .returning({ id: notices.id });

    console.log(`✅ Updated ${updated.length} notice(s) to 'review_needed'`);
    process.exit(0);
}
main();
