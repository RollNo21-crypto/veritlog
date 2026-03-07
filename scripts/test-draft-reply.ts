import { createTRPCContext } from "~/server/api/trpc";
import { appRouter } from "~/server/api/root";
import { db } from "~/server/db";
import { notices } from "~/server/db/schema";
import { eq } from "drizzle-orm";

async function runTest() {
    try {
        console.log("Looking for a test notice to generate a draft reply...");
        const dbNotices = await db.select().from(notices).limit(1);

        if (dbNotices.length === 0) {
            console.log("No notices found in the database. Cannot test draft reply.");
            return;
        }

        const targetNotice = dbNotices[0];
        console.log(`Found notice: ${targetNotice.id} (${targetNotice.noticeType})`);
        console.log(`File URL: ${targetNotice.fileUrl}`);

        // Mock a TRPC context with the notice's tenantId to simulate an authenticated call
        const ctx = await createTRPCContext({ headers: new Headers() });
        // @ts-ignore - circumventing strict header requirement for local test script
        ctx.session = { userId: targetNotice.tenantId };

        const caller = appRouter.createCaller(ctx);

        console.log("\nInitiating AI Draft Reply generation... (this may take a few seconds)");
        const result = await caller.notice.generateDraftReply({ id: targetNotice.id });

        console.log("\n================ DRAFT REPLY GENERATED ================\n");
        console.log(result.draft);
        console.log("\n=======================================================\n");

    } catch (error) {
        console.error("Test failed:", error);
    }
}

void runTest();
