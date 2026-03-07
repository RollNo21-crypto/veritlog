import "dotenv/config";
import { generateDraftResponse } from "../src/server/services/extraction";
import { db } from "../src/server/db";
import { notices } from "../src/server/db/schema";
import { eq, isNotNull, not, and } from "drizzle-orm";

async function runDirectTest() {
    try {
        console.log("Looking for a test notice with a valid PDF attached...");
        const dbNotices = await db
            .select()
            .from(notices)
            .where(
                and(
                    isNotNull(notices.fileUrl),
                    not(eq(notices.fileUrl, '#'))
                )
            )
            .limit(1);

        if (dbNotices.length === 0) {
            console.log("No valid PDF notices found in the database. Cannot test draft reply.");
            return;
        }

        const notice = dbNotices[0];
        console.log(`Found notice: ${notice.id} (${notice.noticeType})`);

        if (!notice.fileUrl || notice.fileUrl === "#") {
            console.log("No document available to analyze.");
            return;
        }

        const noticeData = {
            type: notice.noticeType ?? "Tax Notice",
            authority: notice.authority ?? "Tax Department",
            amount: notice.amount ? `₹${(notice.amount / 100).toLocaleString("en-IN")}` : "Not specified",
            deadline: notice.deadline ?? "Not specified",
            gstin: notice.clientId ?? "Not available"
        };

        console.log("\nInitiating AWS Bedrock Draft Reply generation... (this may take a few seconds)");

        // Ensure env vars for AWS are loaded if needed, tsx usually handles .env
        const { actionPlan, draftLetter } = await generateDraftResponse(notice.fileUrl, noticeData);

        console.log("\n================ IMMEDIATE ACTION PLAN ================\n");
        console.log(actionPlan);
        console.log("\n================ DRAFT REPLY LETTER ===================\n");
        console.log(draftLetter);
        console.log("\n=======================================================\n");

    } catch (error) {
        console.error("Test failed:", error);
    }
}

void runDirectTest();
