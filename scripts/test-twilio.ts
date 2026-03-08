import { sendHighRiskWhatsAppAlert, sendNewEmailAlertToCA } from "../src/server/services/twilio";
import dotenv from "dotenv";

dotenv.config();

console.log("Testing Twilio WhatsApp Alert Integration...");
console.log(`Using CA Phone: ${process.env.WHATSAPP_CA_PHONE}`);

async function testAlert() {
    console.log("\n--- 1. Testing CA Inbox Alert ---");
    const caSuccess = await sendNewEmailAlertToCA(3);
    if (caSuccess) {
        console.log("✅ CA Inbox Alert succeeded.");
    } else {
        console.log("❌ CA Inbox Alert failed.");
    }

    console.log("\n--- 2. Testing Customer High-Risk Alert ---");
    const customerSuccess = await sendHighRiskWhatsAppAlert({
        noticeId: "test_notice_123",
        authority: "DGGI",
        businessName: "Acme Corp Ltd.",
        amount: 500000000,
        deadline: new Date(Date.now() + 86400000).toISOString(), // 24 hours from now
    });

    if (customerSuccess) {
        console.log("✅ Customer Alert succeeded.");
    } else {
        console.log("❌ Customer Alert failed.");
    }
}

testAlert().catch(console.error);
