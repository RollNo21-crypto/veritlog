import "dotenv/config";
import { ImapFlow } from "imapflow";
import { PDFDocument } from "pdf-lib";

async function createPdf(text: string) {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([600, 800]);

    // Simple word wrap for basic text
    const lines = text.split('\n');
    let y = 750;
    for (const line of lines) {
        page.drawText(line, { x: 50, y, size: 12 });
        y -= 20;
    }

    return Buffer.from(await pdfDoc.save()).toString('base64');
}

function buildMime(subject: string, bodyText: string, filename?: string, base64Pdf?: string) {
    const boundary = "----=_NextPart_" + Math.random().toString(36).slice(2);
    let mime = `From: "Test Automation" <mocktest@gst-auto.com>\r\n`;
    mime += `To: ${process.env.EMAIL_IMAP_USER}\r\n`;
    mime += `Subject: ${subject}\r\n`;
    mime += `Date: ${new Date().toUTCString()}\r\n`;
    mime += `MIME-Version: 1.0\r\n`;
    mime += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n`;

    mime += `--${boundary}\r\n`;
    mime += `Content-Type: text/plain; charset=utf-8\r\n\r\n`;
    mime += `${bodyText}\r\n\r\n`;

    if (filename && base64Pdf) {
        mime += `--${boundary}\r\n`;
        mime += `Content-Type: application/pdf; name="${filename}"\r\n`;
        mime += `Content-Transfer-Encoding: base64\r\n`;
        mime += `Content-Disposition: attachment; filename="${filename}"\r\n\r\n`;
        // Break base64 into 76-char lines
        const lines = base64Pdf.match(/.{1,76}/g) || [];
        mime += `${lines.join('\r\n')}\r\n\r\n`;
    }

    mime += `--${boundary}--\r\n`;
    return mime;
}

async function seedEmails() {
    console.log("🚀 Starting Email Seeding...");

    // Generate PDFs beforehand
    console.log("Generating PDFs...");

    // Email 1: Standard Notice with PDF
    const validNoticePdf = await createPdf(
        "SHOW CAUSE NOTICE\n\n" +
        "Reference Number: SCN-2026-0803\n" +
        "GSTIN: 29ABCDE1234F1Z5\n" +
        "Assessee: Alterann Ind\n\n" +
        "Subject: Demand under Section 73\n" +
        "Amount Demanded: Rs. 5,00,000.00\n" +
        "Date of Issue: 08/03/2026\n" +
        "Deadline: Respond within 15 days of this notice.\n\n" +
        "Observation: Discrepancy observed in Input Tax Credit claims for FY 2023-24."
    );

    // Email 3: Invoice Newsletter (Not a notice)
    const invoicePdf = await createPdf(
        "INVOICE #9283\n\n" +
        "From: Cloud Web Services\n" +
        "Total Due: $24.99\n" +
        "Services rendered: Website hosting for February 2026.\n" +
        "Please remit payment by EOM."
    );

    // Email 4: High Risk / Short Deadline foreign language
    const spanishNoticePdf = await createPdf(
        "AVISO DE AUDITORÍA FISCAL\n\n" +
        "Número de Registro: RUT 89.123.456-7\n" +
        "Entidad: Alterann Ind\n\n" +
        "Seccion: 14 B de la ley de Impuesto a la Renta\n" +
        "Monto Requerido: $250,500.00 CLP\n" +
        "Plazo: 2 dias habiles.\n" +
        "Su empresa ha sido seleccionada para una auditoría."
    );

    // Compile Scenarios
    const emails = [
        {
            subject: "DRC-01 Show Cause Notice (Standard PDF)",
            body: "Please find attached the Show Cause Notice issued against your GSTIN.",
            filename: "notice_drc01_attachment.pdf",
            base64: validNoticePdf
        },
        {
            subject: "Alert: GST Intimation Required",
            body: "Dear Alterann Ind,\n\nA new tax discrepancy has been flagged against your PAN ABCDE1238F for FY2022-23.\nThe estimated short payment is Rs. 14,000.50.\nPlease log into the portal to review the exact demand and reply. No document is attached.",
        },
        {
            subject: "URGENT ACTION: YOUR ACCOUNT WAS HACKED!!",
            body: "Dear Customer,\n\nWe noticed suspicious logins. Please click this link immediately to pay a $5.00 recovery fee or your account goes goodbye forever.\n\nRegards,\nAdmin Team"
        },
        {
            subject: "Your Monthly Cloud Hosting Invoice",
            body: "Hi team, attached is the invoice for last month's computing services. Thank you!",
            filename: "invoice_feb2026.pdf",
            base64: invoicePdf
        },
        {
            subject: "Aviso de Auditoría Fiscal Externa",
            body: "Adjunto encontrará el aviso oficial detallando la auditoría iniciada en su contra. Por favor responda en el plazo indicado.",
            filename: "aviso_auditoria.pdf",
            base64: spanishNoticePdf
        },
        {
            subject: "Mismatch Detected - Alterann Ind vs Acme Corp",
            body: "Notice: The trade name registered in our systems (Acme Corp) does not match the PAN registration records (Alterann Ind). Please update immediately.",
        }
    ];

    console.log("Connecting to IMAP...");
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

        for (let i = 0; i < emails.length; i++) {
            console.log(`Injecting email ${i + 1}/${emails.length}: ${emails[i].subject}`);
            const mime = buildMime(emails[i].subject, emails[i].body, emails[i].filename, emails[i].base64);
            // Append as UNREAD (no flags passed in 3rd argument array)
            await client.append('INBOX', mime, []);
            // brief pause to space out timestamps slightly
            await new Promise(r => setTimeout(r, 500));
        }

        console.log("✅ Successfully injected all 6 diverse test emails into INBOX.");
    } catch (e) {
        console.error("❌ IMAP append failed:", e);
    } finally {
        await client.logout();
    }
}

seedEmails();
