import "dotenv/config";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

async function diagnoseMissingAttachments() {
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
            // Find the specific email the user screenshotted
            const searchResult = await client.search({ subject: "Aviso de Auditoría Fiscal Externa" }, { uid: true });
            const uids: number[] = Array.isArray(searchResult) ? searchResult : [];

            if (uids.length === 0) {
                console.log("No matching emails found.");
                return;
            }

            console.log(`Found ${uids.length} matching emails.`);
            const uid = uids[uids.length - 1]; // get the latest one

            const msg = await client.fetchOne(String(uid), { source: true, envelope: true }, { uid: true });
            if (!msg || typeof msg === "boolean" || !msg.source) return;

            console.log(`\nEmail Subject: ${msg.envelope?.subject}`);

            // Output raw structure snippet
            const rawSource = msg.source.toString();
            console.log(`\n--- Raw MIME snippet ---\n${rawSource.substring(0, 500)}...\n------------------------\n`);

            const parsed = await simpleParser(msg.source as Buffer);

            console.log(`Total attachments detected by mailparser: ${parsed.attachments?.length || 0}`);
            if (parsed.attachments && parsed.attachments.length > 0) {
                parsed.attachments.forEach((a, i) => {
                    console.log(`Attachment [${i}]: Name=${a.filename}, Type=${a.contentType}, Size=${a.size}`);
                });
            } else {
                console.log("mailparser failed to register it as an attachment.");
            }

            // Test filtering logic from imap.ts
            const noticeAttachments = (parsed.attachments ?? []).filter(
                (a) => a.contentType === "application/pdf" ||
                    a.contentType.startsWith("image/") ||
                    a.filename?.toLowerCase().endsWith(".pdf") ||
                    a.filename?.toLowerCase().match(/\.(jpg|jpeg|png)$/i)
            );
            console.log(`Attachments passing filter: ${noticeAttachments.length}`);

        } finally {
            lock.release();
        }
    } finally {
        await client.logout();
    }
}
diagnoseMissingAttachments();
