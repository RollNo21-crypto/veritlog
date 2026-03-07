import "dotenv/config";
import { db } from "../src/server/db";
import { notices } from "../src/server/db/schema";

async function check() {
    const rows = await db.select({ id: notices.id, fileName: notices.fileName, fileUrl: notices.fileUrl }).from(notices).limit(10);
    console.log("Notices found:", rows.length);
    for (const r of rows) {
        console.log("  " + r.fileName + " | fileUrl: " + r.fileUrl);
    }
    process.exit(0);
}
check();
