/**
 * WhatsApp Alert Service — via Twilio
 * FR20: Send WhatsApp notifications via Twilio's WhatsApp sandbox/production
 *
 * Required env vars:
 *   TWILIO_ACCOUNT_SID   — from Twilio console (Account Info)
 *   TWILIO_AUTH_TOKEN    — from Twilio console (Account Info)
 *   TWILIO_WHATSAPP_FROM — sandbox: "whatsapp:+14155238886"
 *   WHATSAPP_CA_PHONE    — CA's phone in E.164 (e.g. +919876543210)
 */


type AlertType =
    | "notice_verified"
    | "notice_high_risk"
    | "deadline_reminder_3d"
    | "deadline_reminder_1d"
    | "notice_closed"
    | "notice_approved";

export type WhatsAppAlertPayload = {
    to: string;               // E.164 phone, e.g. "+919876543210"
    type: AlertType;
    noticeId: string;
    noticeType?: string;
    authority?: string;
    deadline?: string;        // ISO date string
    amount?: number;          // paise
    riskLevel?: string;
    deepLinkToken?: string;   // for stories 5.4 — secure share token
};

// ─── Template builders ───────────────────────────────────────────────────────

function rupees(paise?: number) {
    if (!paise) return "–";
    return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

function daysUntil(isoDate?: string): string {
    if (!isoDate) return "–";
    const d = Math.ceil((new Date(isoDate).getTime() - Date.now()) / 86_400_000);
    return d <= 0 ? "TODAY" : `${d} day${d > 1 ? "s" : ""}`;
}

function buildMessageBody(payload: WhatsAppAlertPayload): string {
    const deepLink = payload.deepLinkToken
        ? `\n🔗 View details: ${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/notice/share/${payload.deepLinkToken}`
        : "";

    switch (payload.type) {
        case "notice_verified":
            return (
                `✅ *Notice Verified*\n` +
                `• Type: ${payload.noticeType ?? "–"}\n` +
                `• Authority: ${payload.authority ?? "–"}\n` +
                `• Amount: ${rupees(payload.amount)}\n` +
                `• Deadline: ${payload.deadline ?? "–"} (${daysUntil(payload.deadline)} left)` +
                deepLink
            );

        case "notice_high_risk":
            return (
                `⚠️ *High Risk Notice*\n` +
                `A notice has been flagged as HIGH RISK.\n` +
                `• Type: ${payload.noticeType ?? "–"}\n` +
                `• Authority: ${payload.authority ?? "–"}\n` +
                `• Amount: ${rupees(payload.amount)}\n` +
                `• Deadline: ${payload.deadline ?? "–"} (${daysUntil(payload.deadline)} left)\n` +
                `Immediate action required.` +
                deepLink
            );

        case "deadline_reminder_3d":
            return (
                `🔔 *Deadline Reminder — 3 Days Left*\n` +
                `• Notice: ${payload.noticeType ?? "–"}\n` +
                `• Authority: ${payload.authority ?? "–"}\n` +
                `• Amount: ${rupees(payload.amount)}\n` +
                `• Deadline: ${payload.deadline}` +
                deepLink
            );

        case "deadline_reminder_1d":
            return (
                `🚨 *URGENT — Deadline Tomorrow!*\n` +
                `• Notice: ${payload.noticeType ?? "–"}\n` +
                `• Authority: ${payload.authority ?? "–"}\n` +
                `• Amount: ${rupees(payload.amount)}\n` +
                `• Deadline: ${payload.deadline}\n` +
                `Please take action immediately.` +
                deepLink
            );

        case "notice_closed":
            return (
                `🔒 *Notice Closed*\n` +
                `• Type: ${payload.noticeType ?? "–"}\n` +
                `• Authority: ${payload.authority ?? "–"}\n` +
                `The notice has been successfully resolved.`
            );

        case "notice_approved":
            return (
                `👍 *Response Approved*\n` +
                `• Type: ${payload.noticeType ?? "–"}\n` +
                `• Authority: ${payload.authority ?? "–"}\n` +
                `The client has approved the drafted response.`
            );

        default:
            return `VERITLOG Alert — Notice ${payload.noticeId}` + deepLink;
    }
}

// ─── API call ─────────────────────────────────────────────────────────────────

export type WhatsAppSendResult = {
    success: boolean;
    messageId?: string;
    error?: string;
    simulated?: boolean;
};

/**
 * Send a WhatsApp text message via Cloud API
 * Falls back to simulation-mode when env vars are not set (dev environment)
 */
export async function sendWhatsAppAlert(
    payload: WhatsAppAlertPayload
): Promise<WhatsAppSendResult> {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_WHATSAPP_FROM ?? "whatsapp:+14155238886";

    // ── Simulation mode (dev / missing credentials) ──────────────────────────
    if (!accountSid || !authToken) {
        const body = buildMessageBody(payload);
        console.log(
            `[WhatsApp SIMULATED] To: ${payload.to}\n${body}\n` +
            "---\nSet TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN to send real messages."
        );
        return { success: true, simulated: true, messageId: `sim_${Date.now()}` };
    }

    // ── Live mode via Twilio REST API ─────────────────────────────────────────
    const messageBody = buildMessageBody(payload);
    const to = `whatsapp:${payload.to}`; // Twilio requires "whatsapp:+91..."

    const params = new URLSearchParams({
        From: from,
        To: to,
        Body: messageBody,
    });

    try {
        const res = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
            {
                method: "POST",
                headers: {
                    Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: params.toString(),
            }
        );

        if (!res.ok) {
            const err = (await res.json()) as { message?: string; code?: number };
            const msg = err.message ?? res.statusText;
            console.error(`[WhatsApp/Twilio] Send failed (${err.code}): ${msg}`);
            return { success: false, error: msg };
        }

        const data = (await res.json()) as { sid?: string; status?: string };
        console.log(`[WhatsApp/Twilio] Sent to ${to}, SID: ${data.sid}, status: ${data.status}`);
        return { success: true, messageId: data.sid };
    } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        console.error(`[WhatsApp/Twilio] Fetch error: ${msg}`);
        return { success: false, error: msg };
    }
}

/**
 * Convenience: alert CA when a high-risk notice is created/updated
 */
export async function alertHighRisk(noticeData: {
    noticeId: string;
    noticeType?: string | null;
    authority?: string | null;
    deadline?: string | null;
    amount?: number | null;
    deepLinkToken?: string;
}): Promise<void> {
    const caPhone = process.env.WHATSAPP_CA_PHONE;
    if (!caPhone) return;

    await sendWhatsAppAlert({
        to: caPhone,
        type: "notice_high_risk",
        noticeId: noticeData.noticeId,
        noticeType: noticeData.noticeType ?? undefined,
        authority: noticeData.authority ?? undefined,
        deadline: noticeData.deadline ?? undefined,
        amount: noticeData.amount ?? undefined,
        deepLinkToken: noticeData.deepLinkToken,
    });
}
