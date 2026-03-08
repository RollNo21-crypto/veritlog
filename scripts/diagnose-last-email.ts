import "dotenv/config";
import { ImapFlow } from "imapflow";
import { extractNoticeData } from "../src/server/services/extraction";

async function diagnoseLastEmail() {
    const client = new ImapFlow({
        host: process.env.EMAIL_IMAP_HOST!,
        port: parseInt(process.env.EMAIL_IMAP_PORT || "993"),
        secure: true,
        auth: {
            user: process.env.EMAIL_IMAP_USER!,
            pass: process.env.EMAIL_IMAP_PASS!,
        },
        logger: false,
    });

    try {
        await client.connect();
        const lock = await client.getMailboxLock("INBOX");
        try {
            console.log("Fetching the very last email from INBOX...");
            // Get the highest sequence number
            const status = await client.status('INBOX', { messages: true });
            const total = status.messages ?? 1;

            const message = await client.fetchOne(total, {
                source: true,
                uid: true,
                bodyStructure: true,
                envelope: true,
                bodyParts: ['text']
            });

            if (!message) {
                console.log("No messages found.");
                return;
            }

            console.log(`Email Subject: ${message.envelope.subject}`);
            console.log(`From: ${message.envelope.from[0]?.address}`);

            const simpleParser = (await import("mailparser")).simpleParser;
            const parsed = await simpleParser(message.source);

            const bodyText = (parsed.text ?? parsed.html ?? "").toString().trim().replace(/<[^>]*>?/gm, "");
            console.log(`\n--- Extracted Body Text (first 300 chars) ---\n${bodyText.substring(0, 300)}...\n------------------`);

            if (parsed.attachments && parsed.attachments.length > 0) {
                console.log(`Found ${parsed.attachments.length} attachments.`);
            } else {
                console.log(`No attachments found. Running intimation extraction...`);
                // Run extraction
                const extraction = await extractNoticeData(null, "parallel", bodyText);
                console.log("\n--- Extraction Result ---");
                console.log(JSON.stringify(extraction.data, null, 2));

                const shouldInsert = extraction.data.isIntimation || extraction.data.extractedGstin || extraction.data.extractedPan;
                console.log(`\nWill this be inserted into DB? -> ${shouldInsert ? 'YES' : 'NO'}`);
                if (!shouldInsert) {
                    console.log("REASON: AI did not classify it as an Intimation AND did not find a GSTIN/PAN.");
                }
            }
        } finally {
            lock.release();
        }
    } catch (e) {
        console.error("Error:", e);
    } finally {
        await client.logout();
    }
}

diagnoseLastEmail();
