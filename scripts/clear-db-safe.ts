import "dotenv/config";
import { db } from "../src/server/db";
import { notices, attachments, auditLogs, comments } from "../src/server/db/schema";
import postgres from "postgres";

async function clearDb() {
    console.log("Clearing all notice-related data from the database...");

    // We have to use the raw postgres client to drop tables or delete everything quickly
    const sqlUrl = process.env.DATABASE_URL;
    if (!sqlUrl) throw new Error("DATABASE_URL must be defined");

    const sql = postgres(sqlUrl, { max: 1 });
    try {
        await sql`TRUNCATE TABLE comments, attachments, audit_logs, notices CASCADE`;
        console.log("✅ Database tables truncated successfully.");
    } catch (e) {
        console.error("Failed to clear db:", e);
    } finally {
        await sql.end();
        console.log("Db connection closed.");
    }
}
clearDb();
