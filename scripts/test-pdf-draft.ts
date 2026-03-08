import "dotenv/config";
import { db } from "../src/server/db";
import { notices } from "../src/server/db/schema";
import { generateDraftResponse } from "../src/server/services/extraction";
import { eq, isNotNull, ne } from "drizzle-orm";
import { getPresignedUrl } from "../src/server/services/storage";

async function testDraft() {
    console.log("Fetching a sample notice WITH a PDF...");
    const noticeRows = await db.select().from(notices).where(ne(notices.fileUrl, "#")).limit(1);
    const notice = noticeRows[0];

    if (!notice) {
        console.error("No notice with a PDF found.");
        process.exit(1);
    }

    console.log(`Generating draft for: ${notice.id} (File: ${notice.fileName}, Summary: ${notice.summary})`);

    const noticeData = {
        type: notice.noticeType ?? "Tax Notice",
        authority: notice.authority ?? "Tax Department",
        amount: notice.amount ? `₹${(notice.amount / 100).toLocaleString("en-IN")}` : "Not specified",
        deadline: notice.deadline ?? "Not specified",
        gstin: notice.clientId ?? "Not available",
        summary: notice.summary ?? ""
    };

    try {
        let documentDataUrl = "#";
        const fileName = notice.fileName ?? "document.pdf";
        const ext = fileName.split('.').pop()?.toLowerCase();
        const mimeType = ext === 'pdf' ? 'application/pdf'
            : ext === 'png' ? 'image/png'
                : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
                    : 'application/pdf';

        const s3Key = `${notice.tenantId}/${notice.id}/${fileName}`;
        console.log("Fetching from S3:", s3Key);
        const presignedUrl = await getPresignedUrl(s3Key, 300);
        const fileRes = await fetch(presignedUrl);
        if (fileRes.ok) {
            const arrayBuffer = await fileRes.arrayBuffer();
            const fileBase64 = Buffer.from(arrayBuffer).toString("base64");
            documentDataUrl = `data:${mimeType};base64,${fileBase64}`;
            console.log("Successfully fetched and converted PDF to base64, size:", fileBase64.length);
        } else {
            console.error("Failed to fetch from S3", fileRes.status);
        }

        const { actionPlan, draftLetter } = await generateDraftResponse(documentDataUrl, noticeData);
        console.log("\n--- ACTION PLAN ---\n", actionPlan);
        console.log("\n--- DRAFT LETTER ---\n", draftLetter);
        console.log("\n✅ SUCCESS: Generated draft reply combining PDF and summary.");
    } catch (e) {
        console.error("❌ FAILED:", e);
    }
    process.exit(0);
}

testDraft();
