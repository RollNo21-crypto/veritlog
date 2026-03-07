import { ImapFlow } from "imapflow";
import * as dotenv from "dotenv";
dotenv.config();

async function checkUnread() {
    const host = process.env.EMAIL_IMAP_HOST || "imap.titan.email";
    const port = Number(process.env.EMAIL_IMAP_PORT ?? "993");
    const user = process.env.EMAIL_IMAP_USER;
    const pass = process.env.EMAIL_IMAP_PASS;

    const client = new ImapFlow({
        host,
        port,
        secure: true,
        auth: { user, pass },
        logger: false,
    });

    try {
        await client.connect();
        let lock = await client.getMailboxLock("INBOX");
        try {
            console.log("Checking INBOX for unseen messages...");
            let searchResult = await client.search({ seen: false }, { uid: true });
            console.log("Unread UIDs:", searchResult);

            console.log("Checking INBOX for ALL messages...");
            let allResult = await client.search("ALL", { uid: true });
            console.log("Total UIDs:", allResult.length);
        } finally {
            lock.release();
        }
    } catch (err) {
        console.error("Error connecting to IMAP:", err);
    } finally {
        await client.logout();
    }
}

checkUnread();
