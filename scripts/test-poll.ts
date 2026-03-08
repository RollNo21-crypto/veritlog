import "dotenv/config";
import { pollEmailInbox } from "../src/server/services/imap";

async function main() {
    console.log("Starting IMAP poll...");
    try {
        const tenantId = process.env.EMAIL_TENANT_ID ?? "system";
        const result = await pollEmailInbox(tenantId, "parallel");
        console.log("Poll Complete:", result);
    } catch (e) {
        console.error("Error polling:", e);
    }
    process.exit(0);
}

main();
