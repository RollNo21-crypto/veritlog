import { pollEmailInbox } from "./src/server/services/imap";
import * as dotenv from "dotenv";

dotenv.config();

async function run() {
    const tenantId = process.env.EMAIL_TENANT_ID ?? "system";
    console.log(`Starting poll for ${tenantId}...`);
    try {
        const result = await pollEmailInbox(tenantId, Date.now() + 300000);
        console.log("Result:", result);
    } catch (err) {
        console.error("Error:", err);
    }
}

run();
