import "dotenv/config";
import { pollEmailInbox } from "../src/server/services/imap";

async function main() {
    console.log("Starting IMAP poll directly (same as HTTP route)...");
    try {
        const tenantId = process.env.EMAIL_TENANT_ID ?? "system";
        const deadlineMs = Date.now() + (270 * 1000);
        const result = await pollEmailInbox(tenantId, deadlineMs);
        console.log("✅ Poll Complete:", result);
    } catch (e) {
        console.error("❌ Error polling:", e);
    }
    process.exit(0);
}
main();
