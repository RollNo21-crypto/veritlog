import twilio from "twilio";

/**
 * Sends a WhatsApp alert to the CUSTOMER when a High Risk notice is processed
 */
export async function sendHighRiskWhatsAppAlert({
    noticeId,
    authority,
    businessName,
    amount,
    deadline,
    clientPhone, // Optional real client phone
}: {
    noticeId: string;
    authority: string;
    businessName: string;
    amount: number | null | undefined;
    deadline: string | null | undefined;
    clientPhone?: string | null;
}) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromPhoneNumber = process.env.TWILIO_WHATSAPP_FROM;
    const toPhoneNumber = process.env.WHATSAPP_CA_PHONE;

    // Initialize conditionally to not crash if env vars are missing
    const client = accountSid && authToken ? twilio(accountSid, authToken) : null;

    // Use clientPhone if provided, otherwise fallback to CA Phone for sandbox testing
    const targetPhone = clientPhone || toPhoneNumber;

    if (!client || !fromPhoneNumber || !targetPhone) {
        console.warn("[Twilio] Credentials missing. Skipping WhatsApp alert.");
        return false;
    }

    try {
        const amountStr = amount ? `Rs. ${(amount / 100).toLocaleString("en-IN")}` : "Unknown Amount";

        // This message is now addressed TO THE CUSTOMER
        const message = `🚨 *URGENT COMPLIANCE ALERT* 🚨\n\n` +
            `Dear ${businessName || "Client"},\n\n` +
            `We have received a HIGH RISK tax/statutory notice regarding your account from the ${authority || "Govt. Authority"}.\n\n` +
            `*Demand/Penalty:* ${amountStr}\n` +
            `*Action Deadline:* ${deadline || "Immediate"}\n\n` +
            `Our compliance team is reviewing the matter urgently on your behalf. Please remain available if we request any supporting documents.\n\n` +
            `- Your CA/Audit Partners`;

        // Ensure the toPhoneNumber is formatted correctly for WhatsApp
        const formattedToPhone = targetPhone.startsWith("whatsapp:")
            ? targetPhone
            : `whatsapp:${targetPhone}`;

        const formattedFromPhone = fromPhoneNumber.startsWith("whatsapp:")
            ? fromPhoneNumber
            : `whatsapp:${fromPhoneNumber}`;

        const response = await client.messages.create({
            body: message,
            from: formattedFromPhone,
            to: formattedToPhone,
        });

        console.log(`[Twilio] Customer High Risk Alert sent successfully! Message SID: ${response.sid}`);
        return true;
    } catch (error) {
        console.error("[Twilio] Failed to send Customer WhatsApp alert:", error);
        return false;
    }
}

/**
 * Sends a WhatsApp alert to the CA/Firm when new emails are ingested into Veritlog
 */
export async function sendNewEmailAlertToCA(newCount: number) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromPhoneNumber = process.env.TWILIO_WHATSAPP_FROM;
    const toPhoneNumber = process.env.WHATSAPP_CA_PHONE;

    // Initialize conditionally to not crash if env vars are missing
    const client = accountSid && authToken ? twilio(accountSid, authToken) : null;

    if (!client || !fromPhoneNumber || !toPhoneNumber || newCount <= 0) {
        return false;
    }

    try {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        const link = `${appUrl}/dashboard`;

        const message = `📬 *Veritlog Notification* 📬\n\n` +
            `You have received ${newCount} new compliance notice(s) across your monitored inboxes.\n\n` +
            `Please log into the Veritlog dashboard to run the AI document extraction and clear your queue:\n${link}`;

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

        console.log(`[Twilio] CA Inbox Alert sent successfully! Message SID: ${response.sid}`);
        return true;
    } catch (error) {
        console.error("[Twilio] Failed to send CA Inbox WhatsApp alert:", error);
        return false;
    }
}
