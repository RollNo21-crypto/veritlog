import { db } from "../src/server/db";
import { notices, attachments, auditLogs, comments } from "../src/server/db/schema";
import { inArray } from "drizzle-orm";
// load env
import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });

async function clearDb() {
    console.log("Clearing all notice-related data from the database...");

    try {
        await db.delete(comments);
        console.log("✅ Cleared comments table.");

        await db.delete(attachments);
        console.log("✅ Cleared attachments table.");

        await db.delete(auditLogs);
        console.log("✅ Cleared audit_logs table.");

        await db.delete(notices);
        console.log("✅ Cleared notices table.");

        console.log("Database reset complete.");
    } catch (e) {
        console.error("Failed to clear db:", e);
    }

    process.exit(0);
}

clearDb();
