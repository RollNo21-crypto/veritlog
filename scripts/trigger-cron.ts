const CRON_SECRET = "cron-local-secret-2026-p3nwz";
const URL = `http://localhost:3001/api/cron/poll-email?secret=${CRON_SECRET}`;

async function triggerCron() {
    console.log(`🚀 Triggering IMAP Cron at ${URL}...`);
    try {
        const res = await fetch(URL, {
            headers: {
                "x-cron-secret": CRON_SECRET
            }
        });
        const data = await res.json();
        console.log("📥 Cron Response:", JSON.stringify(data, null, 2));
    } catch (err) {
        console.error("❌ Failed to trigger cron:", err);
    }
}

triggerCron();
