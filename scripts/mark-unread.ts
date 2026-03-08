import "dotenv/config";
import { ImapFlow } from "imapflow";

async function markLastUnread() {
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
            const status = await client.status('INBOX', { messages: true });
            const total = status.messages ?? 1;

            console.log(`Marking message ${total} as UNREAD...`);
            await client.messageFlagsRemove(String(total), ["\\Seen"]);
            console.log("Done.");
        } finally {
            lock.release();
        }
    } finally {
        await client.logout();
    }
}
markLastUnread();
