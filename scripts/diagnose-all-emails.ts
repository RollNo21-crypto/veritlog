import "dotenv/config";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

async function diagnoseAllUnread() {
    const client = new ImapFlow({
        host: process.env.EMAIL_IMAP_HOST!,
        port: parseInt(process.env.EMAIL_IMAP_PORT || "993"),
        secure: true,
        auth: { user: process.env.EMAIL_IMAP_USER!, pass: process.env.EMAIL_IMAP_PASS! },
        logger: false,
    });

    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    try {
        // Get all emails (seen=true also, to look at all 6)
        const searchResult = await client.search({ seen: false }, { uid: true });
        const uids: number[] = Array.isArray(searchResult) ? searchResult : [];
        console.log(`Found ${uids.length} unread emails\n`);

        for (const uid of uids) {
            const msg = await client.fetchOne(String(uid), { source: true, envelope: true }, { uid: true });
            if (!msg || typeof msg === "boolean" || !msg.source) continue;

            const subject = msg.envelope?.subject ?? "(no subject)";
            const parsed = await simpleParser(msg.source as Buffer);
            const allAttachments = parsed.attachments ?? [];

            const pdfFilter = allAttachments.filter(
                (a) => a.contentType === "application/pdf" ||
                    a.contentType.startsWith("image/") ||
                    a.filename?.toLowerCase().endsWith(".pdf") ||
                    a.filename?.toLowerCase().match(/\.(jpg|jpeg|png)$/i)
            );

            console.log(`📧 "${subject}"`);
            console.log(`   Total attachments: ${allAttachments.length}`);
            allAttachments.forEach(a => {
                const passes = pdfFilter.includes(a);
                console.log(`   [${passes ? '✅ PASS' : '❌ FAIL'}] "${a.filename}" | contentType: ${a.contentType} | size: ${a.size}`);
            });
            console.log(`   => noticeAttachments count: ${pdfFilter.length}`);
            console.log(`   => Will process as: ${pdfFilter.length > 0 ? 'PDF/IMAGE (PDF branch)' : 'INTIMATION (text branch)'}\n`);
        }
    } finally {
        lock.release();
        await client.logout();
    }
}
diagnoseAllUnread();
