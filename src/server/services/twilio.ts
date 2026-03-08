import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromPhoneNumber = process.env.TWILIO_WHATSAPP_FROM; // e.g., whatsapp:+14155238886
const toPhoneNumber = process.env.WHATSAPP_CA_PHONE; // e.g., whatsapp:+919876543210

// Initialize conditionally to not crash if env vars are missing
const client = accountSid && authToken ? twilio(accountSid, authToken) : null;

/**
 * Sends a WhatsApp alert when a High Risk notice is processed
 */
export async function sendHighRiskWhatsAppAlert({
    noticeId,
    authority,
    businessName,
    amount,
    deadline,
}: {
    noticeId: string;
    authority: string;
    businessName: string;
    amount: number | null | undefined;
    deadline: string | null | undefined;
}) {
    if (!client || !fromPhoneNumber || !toPhoneNumber) {
        console.warn("[Twilio] Credentials missing. Skipping WhatsApp alert.");
        return false;
    }

    try {
        const amountStr = amount ? `Rs. ${(amount / 100).toLocaleString("en-IN")}` : "Unknown Amount";
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        const link = `${appUrl}/dashboard/verify/${noticeId}`;

        const message = `🚨 *HIGH RISK NOTICE ALERT* 🚨\n\n` +
            `*Authority:* ${authority}\n` +
            `*Client:* ${businessName}\n` +
            `*Demand:* ${amountStr}\n` +
            `*Deadline:* ${deadline || "Immediate"}\n\n` +
            `Please review and assign immediately:\n${link}`;

        // Ensure the toPhoneNumber is formatted correctly for WhatsApp
        const formattedToPhone = toPhoneNumber.startsWith("whatsapp:")
            ? toPhoneNumber
            : `whatsapp:${toPhoneNumber}`;

        const formattedFromPhone = fromPhoneNumber.startsWith("whatsapp:")
            ? fromPhoneNumber
            : `whatsapp:${fromPhoneNumber}`;

        const response = await client.messages.create({
            body: message,
            from: formattedFromPhone,
            to: formattedToPhone,
        });

        console.log(`[Twilio] WhatsApp Alert sent successfully! Message SID: ${response.sid}`);
        return true;
    } catch (error) {
        console.error("[Twilio] Failed to send WhatsApp alert:", error);
        return false;
    }
}
