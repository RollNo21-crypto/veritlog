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

    // Email 1: Standard Notice with PDF -> Maps to Acme Corp India
    const validNoticePdf = await createPdf(
        "SHOW CAUSE NOTICE\n\n" +
        "Reference Number: SCN-2026-0803\n" +
        "GSTIN: 27ABCDE1234F1Z5\n" +
        "Assessee: Acme Corp India\n\n" +
        "Subject: Demand under Section 73\n" +
        "Amount Demanded: Rs. 5,00,000.00\n" +
        "Date of Issue: 08/03/2026\n" +
        "Deadline: Respond within 15 days of this notice.\n\n" +
        "Observation: Discrepancy observed in Input Tax Credit claims for FY 2023-24."
    );

    // Email 3: EPFO Notice (Not a tax notice, but statutory)
    const epfoPdf = await createPdf(
        "EMPLOYEES' PROVIDENT FUND ORGANISATION\n" +
        "MINISTRY OF LABOUR & EMPLOYMENT, GOVT OF INDIA\n\n" +
        "To: Acme Corp India\n" +
        "Subject: Delay in EPF Contribution Remittance\n\n" +
        "It is observed that the EPF contributions for the wage month of Jan 2026\n" +
        "amounting to Rs. 45,600 have not been deposited as per Section 7A.\n" +
        "Please remit payment immediately to avoid penal damages under 14B."
    );

    // Email 4: High Risk / Short Deadline Income Tax Notice (Hindi/English) -> Maps to Alterann Ind
    const itNoticePdf = await createPdf(
        "INCOME TAX DEPARTMENT\n" +
        "GOVERNMENT OF INDIA\n\n" +
        "PAN Registrado: ABCDE1238F\n" +
        "Name: Alterann Ind\n\n" +
        "Notice under Section 143(2) of the Income Tax Act, 1961\n" +
        "Assessement Year: 2024-25\n" +
        "Demand Amount: Rs. 1,25,500\n" +
        "Immediate attention required. Your case has been selected for\n" +
        "Complete Scrutiny. Please submit the requested documents within\n" +
        "5 days of receipt of this notice."
    );

    // Email 7: SUPER HIGH RISK - Triggers WhatsApp Alert
    const superHighRiskPdf = await createPdf(
        "DIRECTORATE GENERAL OF GST INTELLIGENCE (DGGI)\n\n" +
        "URGENT SHOW CAUSE CUM DEMAND NOTICE\n\n" +
        "PAN: AAA7687686\n" +
        "Entity: MarLabs\n\n" +
        "Subject: Evasion of GST under Section 74\n" +
        "Demand Amount: Rs. 5,00,00,000 (Five Crores Only)\n" +
        "Deadline: IMMEDIATE ACTION REQUIRED. Respond within 24 hours.\n\n" +
        "Failure to deposit the demanded amount will result in immediate\n" +
        "attachment of bank accounts and suspension of GSTIN."
    );

    // Email 8: SEVERE - Bank Attachment Notice
    const bankAttachmentPdf = await createPdf(
        "OFFICE OF THE RECOVERY OFFICER\n" +
        "INCOME TAX DEPARTMENT\n\n" +
        "PAN: ABCDE1238F\n" +
        "Entity: Alterann Ind\n\n" +
        "ORDER OF ATTACHMENT OF BANK ACCOUNT\n" +
        "Section 226(3) of the Income Tax Act, 1961\n\n" +
        "Due to failure to clear outstanding demand of Rs. 45,00,000,\n" +
        "your bank accounts are hereby attached. Immediate appearance\n" +
        "required before the undersigned within 3 days."
    );

    // Email 9: NON-SEVERE - Routine Information Request
    const infoRequestPdf = await createPdf(
        "DEPARTMENT OF COMMERCIAL TAXES\n\n" +
        "GSTIN: 27ABCDE1234F1Z5\n" +
        "Entity: Acme Corp India\n\n" +
        "Subject: Clarification on HSN Codes\n\n" +
        "This is a routine request to provide clarification regarding\n" +
        "the HSN codes used in your GSTR-1 for the month of December 2025.\n" +
        "Please submit the classification worksheet at your earliest convenience.\n" +
        "No immediate demand is raised."
    );

    // Email 10: NON-SEVERE - Refund Rejection
    const refundRejectionPdf = await createPdf(
        "GOODS AND SERVICES TAX NETWORK\n\n" +
        "PAN: AAA7687686\n" +
        "Entity: MarLabs\n\n" +
        "ORDER OF REJECTION OF REFUND CLAIM\n\n" +
        "Your application for refund of accumulated ITC amounting to\n" +
        "Rs. 2,50,000 has been partially rejected due to missing\n" +
        "invoices. Please file an appeal if you wish to contest."
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
            // Maps to MarLabs purely via text body
            subject: "Alert: GST Intimation Required",
            body: "Dear MarLabs,\n\nA new tax discrepancy has been flagged against your PAN AAA7687686 for FY2022-23.\nThe estimated short payment is Rs. 14,000.50.\nPlease log into the portal to review the exact demand and reply. No document is attached.",
        },
        {
            subject: "URGENT ACTION: INCOME TAX REFUND",
            body: "Dear Taxpayer,\n\nYour refund of Rs. 45,000 is pending. Please click this link and verify your bank account details immediately.\n\nRegards,\nIT Dept Admin"
        },
        {
            subject: "EPFO: Notice for non-payment of dues",
            body: "Respected Employer, attached is the notice regarding delay in EPF remittance. Please do the needful.",
            filename: "epfo_notice_jan2026.pdf",
            base64: epfoPdf
        },
        {
            subject: "Notice u/s 143(2) of Income Tax Act",
            body: "Please find attached the notice under Section 143(2) for AY 2024-25. You are requested to furnish the details online.",
            filename: "it_notice_143_2.pdf",
            base64: itNoticePdf
        },
        {
            subject: "MCA Alert: Mismatch Detected - Alterann Ind vs Acme Corp India",
            body: "Notice: The trade name registered in MCA portal (Acme Corp India) does not match the GSTIN registration records (Alterann Ind). Please update Director KYC immediately.",
        },
        {
            subject: "URGENT: DGGI Demand Notice (Rs 5.0 Cr)",
            body: "Dear Assessee, please find the attached demand notice issued by DGGI. Immediate compliance is required.",
            filename: "dggi_demand_5cr.pdf",
            base64: superHighRiskPdf
        },
        {
            subject: "CRITICAL: Bank Account Attachment Order",
            body: "Warning: Your bank accounts have been marked for attachment due to unpaid tax dues. See attached order.",
            filename: "it_bank_attachment.pdf",
            base64: bankAttachmentPdf
        },
        {
            subject: "Routine Clarification Needed: HSN Codes",
            body: "Please find attached a request for clarification regarding your recent GSTR-1 filings. This is an informational request.",
            filename: "hsn_clarification_req.pdf",
            base64: infoRequestPdf
        },
        {
            subject: "Update on GST Refund Application",
            body: "Your recent application for GST refund has been processed. Please review the attached order for details on rejected amounts.",
            filename: "refund_rejection_order.pdf",
            base64: refundRejectionPdf
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
