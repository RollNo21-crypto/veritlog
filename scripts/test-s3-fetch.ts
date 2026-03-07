import "dotenv/config";
import { db } from "../src/server/db";
import { notices } from "../src/server/db/schema";
import { getPresignedUrl } from "../src/server/services/storage";

async function check() {
    const rows = await db.select({ id: notices.id, fileName: notices.fileName, fileUrl: notices.fileUrl }).from(notices).limit(10);
    for (const r of rows) {
        if (r.fileUrl && r.fileUrl !== "#") {
            const fileKey = r.fileUrl.replace("/api/files/", "");
            console.log("Extracted fileKey:", fileKey);
            try {
                const url = await getPresignedUrl(decodeURIComponent(fileKey), 3600);
                console.log("Presigned URL created successfully:", url.substring(0, 100) + "...");

                // Try fetching the presigned URL
                const res = await fetch(url);
                console.log(`Fetch from S3 returned status: ${res.status}`);
            } catch (err) {
                console.error("Error creating presigned URL:", err);
            }
        }
    }
    process.exit(0);
}
check();
