import "dotenv/config";
import { ImapFlow } from "imapflow";

/**
 * Diagnostic script: Marks recent emails in the INBOX as UNREAD
 * so the IMAP poll can re-process them and we can verify the full flow.
 */
async function markEmailsUnread() {
    const host = process.env.EMAIL_IMAP_HOST;
    const port = Number(process.env.EMAIL_IMAP_PORT ?? "993");
    const user = process.env.EMAIL_IMAP_USER;
    const pass = process.env.EMAIL_IMAP_PASS;

    if (!host || !user || !pass) {
        console.error("Missing EMAIL_IMAP_* env vars.");
        return;
    }

    const client = new ImapFlow({
        host, port, secure: true,
        auth: { user, pass },
        logger: false,
    });

    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    try {
        // Get last 10 messages (most recent)
        const status = await client.status("INBOX", { messages: true, unseen: true });
        console.log(`📬 Mailbox: ${status.messages} total, ${status.unseen ?? 0} unread.`);

        // Search for ALL messages (including seen) — take last 5
        const allUids = await client.search({ all: true }, { uid: true });
        const uids = Array.isArray(allUids) ? allUids.slice(-5) : [];

        if (uids.length === 0) {
            console.log("No messages in inbox.");
            return;
        }

        console.log(`Marking ${uids.length} messages as UNREAD (UIDs: ${uids.join(", ")})...`);
        for (const uid of uids) {
            await client.messageFlagsRemove(String(uid), ["\\Seen"], { uid: true });
        }
        console.log("✅ Done! Messages are now marked as unread. Run imap-poll again.");
    } finally {
        lock.release();
        await client.logout();
    }
}

void markEmailsUnread();
