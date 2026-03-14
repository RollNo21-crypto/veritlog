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

    // Twilio sandbox only allows sending to verified numbers (the CA's phone). 
    // If we're using the sandbox sender, override the target to the CA's phone to prevent delivery failure.
    const isSandbox = fromPhoneNumber === "whatsapp:+14155238886";
    const targetPhone = isSandbox ? toPhoneNumber : (clientPhone || toPhoneNumber);

    if (!client || !fromPhoneNumber || !targetPhone) {
        console.warn("[Twilio] Credentials missing. Skipping WhatsApp alert.");
        return false;
    }

    try {
        const amountStr = amount !== null && amount !== undefined ? `Rs. ${(amount / 100).toLocaleString("en-IN")}` : "Unknown Amount";

        // Make the deadline human readable if it's an ISO string
        let formattedDeadline = "Immediate";
        if (deadline) {
            try {
                formattedDeadline = new Date(deadline).toLocaleDateString("en-IN", {
                    day: "numeric", month: "long", year: "numeric"
                });
            } catch {
                formattedDeadline = deadline;
            }
        }

        // This message is now addressed TO THE CUSTOMER
        const message = `🚨 *URGENT COMPLIANCE ALERT* 🚨\n\n` +
            `Dear ${businessName || "Client"},\n\n` +
            `We have received a HIGH RISK tax/statutory notice regarding your account from the ${authority || "Govt. Authority"}.\n\n` +
            `*Demand/Penalty:* ${amountStr}\n` +
            `*Action Deadline:* ${formattedDeadline}\n\n` +
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

/**
 * Sends a WhatsApp message with a payment link to the customer
 */
export async function sendPaymentLinkWhatsApp({
    noticeId,
    authority,
    amount,
    clientPhone,
}: {
    noticeId: string;
    authority: string;
    amount: number | null | undefined;
    clientPhone?: string | null;
}) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromPhoneNumber = process.env.TWILIO_WHATSAPP_FROM;
    const toPhoneNumber = process.env.WHATSAPP_CA_PHONE;

    const client = accountSid && authToken ? twilio(accountSid, authToken) : null;
    const isSandbox = fromPhoneNumber === "whatsapp:+14155238886";
    const targetPhone = isSandbox ? toPhoneNumber : (clientPhone || toPhoneNumber);

    if (!client || !fromPhoneNumber || !targetPhone) {
        return false;
    }

    try {
        const amountStr = amount !== null && amount !== undefined ? `Rs. ${(amount / 100).toLocaleString("en-IN")}` : "Unknown Amount";
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        // Create a mock payment link
        const paymentLink = `${appUrl}/pay/${noticeId}`;

        const message = `💳 *Payment Request* 💳\n\n` +
            `Your CA has requested a payment for a tax penalty/demand from the ${authority || "Govt. Authority"}.\n\n` +
            `*Amount Due:* ${amountStr}\n\n` +
            `Please click the secure Pine Labs link below to approve and pay this penalty immediately to avoid further complications:\n` +
            `${paymentLink}\n\n` +
            `- Powered by Veritlog & Pine Labs`;

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

        console.log(`[Twilio] Payment Link sent successfully! Message SID: ${response.sid}`);
        return true;
    } catch (error) {
        console.error("[Twilio] Failed to send Payment Link WhatsApp alert:", error);
        return false;
    }
}
