// Quick test: node scripts/test-imap.mjs
import { ImapFlow } from "imapflow";

const configs = [
    { host: "imap.titan.email", port: 993, secure: true },
    { host: "mail.titan.email", port: 993, secure: true },
    { host: "imap.neo.space", port: 993, secure: true },
];

for (const config of configs) {
    console.log(`\nTrying ${config.host}:${config.port}...`);
    const client = new ImapFlow({
        ...config,
        auth: {
            user: "support@reznico.tech",
            pass: "Ravalnath@12",
        },
        logger: false,
    });

    try {
        await client.connect();
        console.log(`✅ SUCCESS on ${config.host}!`);

        const lock = await client.getMailboxLock("INBOX");
        try {
            const status = await client.status("INBOX", { messages: true, unseen: true });
            console.log(`📬 Total messages: ${status.messages}`);
            console.log(`📨 Unread: ${status.unseen}`);
        } finally {
            lock.release();
        }
        await client.logout();
        break;
    } catch (err) {
        console.error(`❌ ${config.host} failed: ${err.message}`);
        try { await client.logout(); } catch { /* ignore */ }
    }
}
