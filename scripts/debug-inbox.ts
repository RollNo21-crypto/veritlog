import "dotenv/config";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

async function debugInbox() {
    const host = process.env.EMAIL_IMAP_HOST!;
    const port = Number(process.env.EMAIL_IMAP_PORT ?? "993");
    const user = process.env.EMAIL_IMAP_USER!;
    const pass = process.env.EMAIL_IMAP_PASS!;

    const client = new ImapFlow({ host, port, secure: true, auth: { user, pass }, logger: false });
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");

    try {
        const uids: number[] = Array.isArray(await client.search({ seen: false }, { uid: true }))
            ? (await client.search({ seen: false }, { uid: true }) as number[])
            : [];

        console.log(`📬 Found ${uids.length} unread email(s)\n`);

        for (const uid of uids) {
            console.log(`\n──── UID: ${uid} ────`);
            try {
                const msg = await client.fetchOne(String(uid), { source: true, envelope: true }, { uid: true });
                if (!msg?.source) { console.log("  ⚠️ No source"); continue; }
                console.log(`  Subject: ${msg.envelope?.subject}`);

                const parsed = await simpleParser(msg.source as Buffer);
                const atts = parsed.attachments ?? [];
                console.log(`  Attachments: ${atts.length} total`);

                for (const a of atts) {
                    console.log(`    - ${a.filename} | type: ${a.contentType} | size: ${a.content?.length} bytes`);
                    // Check buffer validity
                    const buf = a.content;
                    try {
                        const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
                        console.log(`      ArrayBuffer size: ${(ab as ArrayBuffer).byteLength} bytes ✅`);
                    } catch (e) {
                        console.log(`      ArrayBuffer ERROR: ${e} ❌`);
                    }
                }

                const bodyText = (parsed.text ?? "").trim();
                console.log(`  Body length: ${bodyText.length} chars`);
            } catch (e) {
                console.error(`  ❌ FETCH ERROR: ${e}`);
            }
        }
    } finally {
        lock.release();
    }

    await client.logout();
}

debugInbox().catch(console.error).finally(() => process.exit(0));
