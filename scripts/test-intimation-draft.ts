import "dotenv/config";
import { db } from "../src/server/db";
import { notices } from "../src/server/db/schema";
import { generateDraftResponse } from "../src/server/services/extraction";
import { eq } from "drizzle-orm";

async function testDraft() {
    console.log("Fetching a sample intimation notice...");
    const notice = await db.select().from(notices).where(eq(notices.fileUrl, "#")).limit(1).then(r => r[0]);
    if (!notice) {
        console.error("No intimation notice found.");
        process.exit(1);
    }

    console.log(`Generating draft for: ${notice.id} (Summary: ${notice.summary})`);

    const noticeData = {
        type: notice.noticeType ?? "Tax Notice",
        authority: notice.authority ?? "Tax Department",
        amount: notice.amount ? `₹${(notice.amount / 100).toLocaleString("en-IN")}` : "Not specified",
        deadline: notice.deadline ?? "Not specified",
        gstin: notice.clientId ?? "Not available",
        summary: notice.summary ?? ""
    };

    try {
        const { actionPlan, draftLetter } = await generateDraftResponse("#", noticeData);
        console.log("\n--- ACTION PLAN ---\n", actionPlan);
        console.log("\n--- DRAFT LETTER ---\n", draftLetter);
        console.log("\n✅ SUCCESS: Generated draft reply without PDF.");
    } catch (e) {
        console.error("❌ FAILED:", e);
    }
    process.exit(0);
}

testDraft();
