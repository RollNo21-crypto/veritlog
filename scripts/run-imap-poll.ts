import * as dotenv from "dotenv";
dotenv.config();

async function run() {
    console.log("Starting IMAP poll via direct function call...");
    const tenantId = process.env.EMAIL_TENANT_ID ?? "system";
    try {
        const { pollEmailInbox } = await import("../src/server/services/imap");
        const result = await pollEmailInbox(tenantId);
        console.log("Poll result:", result);
    } catch (err) {
        console.error("Poll failed:", err);
    }
    process.exit(0);
}

run();
