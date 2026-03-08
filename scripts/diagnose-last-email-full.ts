import "dotenv/config";
import { ImapFlow } from "imapflow";
import { extractNoticeData } from "../src/server/services/extraction";
import { uploadToS3 } from "../src/server/services/storage";

async function diagnoseLastEmailFull() {
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
        const lock = await client.getMailboxLock("INBOX");
        try {
            console.log("Fetching the very last email from INBOX...");
            const status = await client.status('INBOX', { messages: true });
            const total = status.messages ?? 1;

            const message = await client.fetchOne(total, {
                source: true,
                uid: true,
                envelope: true
            });

            if (!message) return;
            console.log(`Email Subject: ${message.envelope.subject}`);

            const simpleParser = (await import("mailparser")).simpleParser;
            const parsed = await simpleParser(message.source);

            const noticeAttachments = (parsed.attachments ?? []).filter(
                (a) => a.contentType === "application/pdf" ||
                    a.contentType.startsWith("image/") ||
                    a.filename?.toLowerCase().endsWith(".pdf") ||
                    a.filename?.toLowerCase().match(/\.(jpg|jpeg|png)$/i)
            );

            console.log(`Found ${noticeAttachments.length} valid attachments out of ${parsed.attachments?.length}`);

            if (noticeAttachments.length > 0) {
                for (const attachment of noticeAttachments) {
                    const filename = attachment.filename ?? `notice_${Date.now()}`;
                    const buffer = attachment.content;
                    const contentType = attachment.contentType || "application/octet-stream";
                    console.log(`Processing attachment: ${filename} (${contentType})`);

                    const tenantId = process.env.EMAIL_TENANT_ID ?? "system";
                    const noticeId = `notice_${Date.now()}_test`;
                    const s3Key = `${tenantId}/${noticeId}/${filename}`;

                    try {
                        console.log(`☁️ Uploading to S3... Key: ${s3Key}`);
                        const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
                        const s3Result = await uploadToS3(s3Key, arrayBuffer, contentType);
                        console.log("✅ S3 Upload Success:", s3Result.fileUrl);

                        const bodyText = (parsed.text || "").trim();
                        const dataUrl = `data:${contentType};base64,${buffer.toString("base64")}`;

                        console.log("🤖 Running Extraction...");
                        const extraction = await extractNoticeData(dataUrl, "parallel", bodyText);
                        console.log("✅ Extraction Success");

                        const { notices } = await import("../src/server/db/schema");
                        const { db } = await import("../src/server/db");

                        function calcRiskLoc(deadline?: string | null, amountPaise?: number | null): "high" | "medium" | "low" {
                            if (amountPaise && amountPaise > 500000_00) return "high";
                            if (deadline) {
                                const days = (new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
                                if (days < 7) return "high";
                            }
                            return "medium";
                        }

                        const amountPaise = extraction.data.amount ? Math.round(extraction.data.amount * 100) : null;
                        const riskLevel = calcRiskLoc(extraction.data.deadline, amountPaise);

                        console.log(`💾 Inserting notice into DB with amountPaise: ${amountPaise}...`);
                        await db.insert(notices).values({
                            id: noticeId,
                            tenantId,
                            status: "processing",
                            fileName: filename,
                            fileUrl: s3Result.fileUrl,
                            fileHash: s3Result.fileHash,
                            noticeType: extraction.data.noticeType ?? null,
                            authority: extraction.data.authority ?? null,
                            section: extraction.data.section ?? null,
                            financialYear: extraction.data.financialYear ?? null,
                            amount: amountPaise,
                            deadline: extraction.data.deadline ?? null,
                            summary: extraction.data.summary ?? null,
                            confidence: extraction.confidence,
                            riskLevel,
                            isTranslated: extraction.data.isTranslated,
                            originalLanguage: extraction.data.originalLanguage,
                            source: "email",
                            createdAt: new Date(),
                            updatedAt: new Date(),
                        });
                        console.log("✅ DB Insertion SUCCESS!");
                    } catch (e) {
                        console.error("❌ ERROR Processing Attachment:", e);
                    }
                }
            } else {
                console.log("No valid attachments. Running intimation loop...");
                const bodyText = (parsed.text || "").trim();
                const extraction = await extractNoticeData(null, "mock", bodyText);
                console.log("Extraction Result (isIntimation):", extraction.data.isIntimation);
            }
        } finally {
            lock.release();
        }
    } finally {
        await client.logout();
    }
}
diagnoseLastEmailFull();
