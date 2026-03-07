import postgres from "postgres";
import * as dotenv from "dotenv";
dotenv.config();

async function checkUrl() {
    const url = process.env.DATABASE_URL || "postgresql://vertilog:Vertilog%242026@vertilog.c7qic2o042mj.ap-south-1.rds.amazonaws.com:5432/postgres?sslmode=require";
    const sql = postgres(url);
    try {
        const notices = await sql`SELECT id, "fileName", "fileUrl" FROM notices LIMIT 5`;
        console.log("Notices:", notices);
    } catch (e) {
        console.error(e);
    } finally {
        await sql.end();
    }
}

checkUrl();
