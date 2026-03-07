import postgres from "postgres";
import * as dotenv from "dotenv";
dotenv.config();

async function fixUrls() {
    console.log("Connecting to AWS RDS database to fix fileUrls...");
    const url = process.env.DATABASE_URL || "postgresql://vertilog:Vertilog%242026@vertilog.c7qic2o042mj.ap-south-1.rds.amazonaws.com:5432/postgres?sslmode=require";
    const sql = postgres(url);

    try {
        const result = await sql`
            UPDATE "notices"
            SET "file_url" = REPLACE("file_url", '%2F', '/')
            WHERE "file_url" LIKE '%api%files%%2F%'
        `;
        console.log(`✅ Fixed ${result.count} notice file URLs.`);
    } catch (e) {
        console.error("Failed to update db:", e);
    } finally {
        await sql.end();
    }
}

fixUrls();
