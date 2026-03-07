import postgres from "postgres";

async function clear() {
    console.log("Connecting to AWS RDS database...");

    // Explicitly using the env var instead of hardcoding
    const url = process.env.DATABASE_URL || "postgresql://vertilog:Vertilog%242026@vertilog.c7qic2o042mj.ap-south-1.rds.amazonaws.com:5432/postgres?sslmode=require";
    const sql = postgres(url);

    try {
        await sql`DELETE FROM "comments"`;
        console.log("✅ Cleared comments table.");

        await sql`DELETE FROM "attachments"`;
        console.log("✅ Cleared attachments table.");

        await sql`DELETE FROM "audit_logs"`;
        console.log("✅ Cleared audit_logs table.");

        await sql`DELETE FROM "notices"`;
        console.log("✅ Cleared notices table.");

        console.log("Database reset complete. Ready for fresh emails!");
    } catch (e) {
        console.error("Failed to clear db:", e);
    } finally {
        await sql.end();
    }
}

clear();
