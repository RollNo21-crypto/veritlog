/**
 * AI Extraction Service — Parallel AI Execution (Bedrock + Gemini)
 * Extracts structured data from Indian tax notice documents.
 *
 * Runs Amazon Nova Pro (via Bedrock Converse API) and Google Gemini 2.0 Flash
 * in parallel. Compares confidence scores and returns the best result.
 */

import {
    BedrockRuntimeClient,
    ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";
import type { Message } from "@aws-sdk/client-bedrock-runtime";
import { GoogleGenAI } from "@google/genai";

export interface NoticeExtraction {
    authority: string | null;
    noticeType: string | null;
    amount: number | null;
    deadline: string | null; // ISO date YYYY-MM-DD
    section: string | null;
    financialYear: string | null;
    summary: string | null;
    nextSteps: string | null;
    requiredDocuments: string | null;
    extractedPan: string | null;
    extractedGstin: string | null;
    extractedBusinessName: string | null;
    extractedContactName: string | null;
    isIntimation: boolean;
    isTranslated: boolean;
    originalLanguage: string | null;
    riskLevel: "high" | "medium" | "low" | null;
}

export interface ExtractionResult {
    data: NoticeExtraction;
    confidence: "high" | "medium" | "low";
    provider: "bedrock" | "gemini" | "mock";
    processingTime: number;
}

// Model Configurations
const BEDROCK_MODEL_ID = "us.amazon.nova-pro-v1:0";
const GEMINI_MODEL_ID = "gemini-2.0-flash";

const SYSTEM_INSTRUCTION = `You are an expert Chartered Accountant specializing in Indian tax litigation and regulatory notices (GST, Income Tax, Customs, SEBI, etc.).
Extract the following fields from the document and return ONLY valid JSON with no markdown or code fences.

CRITICAL RULES:
- The "amount" field MUST be a plain number in Indian Rupees (INR). Example: if the notice demands ₹2,50,000 write 250000. Do NOT convert to paise.
- Always look for GSTIN (15-char format: 29ABCDE1234F1Z5) and PAN (10-char: ABCDE1234F) and extract them exactly.
- For deadline: calculate the date from any phrases like "within 30 days" and return in YYYY-MM-DD format.
- For non-GST/Income-tax notices (e.g., SEBI, Customs, RERA), still extract the relevant fields.
- If this is a scam/phishing email (no legitimate government authority, asks for payment to a private account, contains threats not backed by law), set isIntimation to false and mark authority as "SUSPECTED PHISHING - DO NOT ACT".

Return this exact JSON schema:
{
  "authority": "Full name of the issuing authority/department",
  "noticeType": "Specific notice type e.g. Show Cause Notice under Section 74, Demand Notice, Scrutiny Notice",
  "amount": <number in INR or null>,
  "deadline": "YYYY-MM-DD or null",
  "section": "Legal section(s) and Act name e.g. Section 74 of CGST Act, 2017",
  "financialYear": "e.g. 2023-24 or null",
  "nextSteps": "Numbered action list: what the CA must do immediately, within 7 days, and before the deadline",
  "requiredDocuments": "Numbered list of documents the client must provide to draft the reply: GSTR filings, invoices, ledgers, bank statements etc.",
  "extractedPan": "Exact 10-char PAN from the document or null",
  "extractedGstin": "Exact 15-char GSTIN from the document or null",
  "extractedBusinessName": "Business/company name that the notice is addressed to",
  "extractedContactName": "Name of the proprietor, director, or authorized signatory",
  "isIntimation": <true if this is an email alert without the full PDF notice, false if this IS the full notice>,
  "isTranslated": <true if document was non-English and you translated it>,
  "originalLanguage": "Language name if translated, else null",
  "summary": "Write a 3-5 sentence executive summary for the CA. Must include: (1) who issued the notice, (2) what law/section was invoked, (3) the exact demand amount and financial year, (4) the core allegation or reason for the notice, (5) the deadline for response. If translated, append ' (Translated from [Language]).'",
  "riskLevel": "Classify the risk level as 'high', 'medium', or 'low'. STRICTLY 'high' if there are large penalties, cancellation threats, or imminent deadlines (<= 7 days)."
}
Return only the JSON object, no explanation, no markdown.`;

// Create static clients
const bedrock = new BedrockRuntimeClient({
    region: "us-east-1",
    credentials:
        process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
            ? {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            }
            : undefined,
});

const gemini = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY || "",
});

/**
 * Main extraction entry point. Runs both AIs concurrently.
 */
export async function extractNoticeData(
    fileUrl: string | null,
    mode: "parallel" | "mock" = "parallel",
    emailText?: string
): Promise<ExtractionResult> {
    const startTime = Date.now();

    if (mode === "mock") {
        return extractMockData(startTime);
    }

    try {
        console.log("[Extraction] Starting parallel AI extraction (Bedrock Nova + Gemini 2.0)...");

        // Run both promises concurrently but don't fail if one crashes
        const [bedrockResult, geminiResult] = await Promise.allSettled([
            extractWithBedrock(fileUrl, startTime, emailText),
            extractWithGemini(fileUrl, startTime, emailText)
        ]);

        let bestResult: ExtractionResult | null = null;
        let bestScore = -1;

        const scoreMap = { high: 3, medium: 2, low: 1 };

        if (bedrockResult.status === "fulfilled") {
            const score = scoreMap[bedrockResult.value.confidence];
            if (score > bestScore) {
                bestScore = score;
                bestResult = bedrockResult.value;
            }
        } else {
            console.warn("[Extraction] Bedrock failed:", bedrockResult.reason);
        }

        if (geminiResult.status === "fulfilled") {
            const score = scoreMap[geminiResult.value.confidence];
            // Prefer Gemini if scores are tied (or >) since it is faster
            if (score >= bestScore) {
                bestScore = score;
                bestResult = geminiResult.value;
            }
        } else {
            console.warn("[Extraction] Gemini failed:", geminiResult.reason);
        }

        if (bestResult) {
            console.log(`[Extraction] Selected ${bestResult.provider} with ${bestResult.confidence} confidence.`);
            return bestResult;
        }

        throw new Error("Both AI models failed to extract data.");
    } catch (error) {
        console.error("[Extraction] Parallel execution failed, falling back to mock:", error);
        // Don't silently mock on production — re-throw so the caller knows
        throw error;
    }
}

// ─── Bedrock Nova Implementation ───────────────────────────────────────────────

async function extractWithBedrock(
    fileUrl: string | null,
    startTime: number,
    emailText?: string
): Promise<ExtractionResult> {
    const messages: Message[] = [];

    if (fileUrl && fileUrl.startsWith("data:")) {
        const commaIdx = fileUrl.indexOf(",");
        const header = fileUrl.substring(5, commaIdx);
        const mimeType = header.split(";")[0] ?? "application/pdf";
        const base64Data = fileUrl.substring(commaIdx + 1);

        const binaryStr = atob(base64Data);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
        }

        const format = mimeType === "application/pdf" ? "pdf" : mimeType.replace("image/", "");

        if (mimeType === "application/pdf") {
            messages.push({
                role: "user",
                content: [
                    { document: { name: "notice", format: "pdf", source: { bytes } } },
                    { text: emailText ? `EMAIL CONTEXT:\n${emailText}\n\n${SYSTEM_INSTRUCTION}` : SYSTEM_INSTRUCTION },
                ],
            });
        } else {
            messages.push({
                role: "user",
                content: [
                    { image: { format: format as "png" | "jpeg" | "gif" | "webp", source: { bytes } } },
                    { text: emailText ? `EMAIL CONTEXT:\n${emailText}\n\n${SYSTEM_INSTRUCTION}` : SYSTEM_INSTRUCTION },
                ],
            });
        }
    } else if (fileUrl) {
        messages.push({
            role: "user",
            content: [{ text: `Document URL: ${fileUrl}` + (emailText ? `\n\nEMAIL CONTENT:\n${emailText}` : "") + `\n\n${SYSTEM_INSTRUCTION}` }],
        });
    } else if (emailText) {
        messages.push({
            role: "user",
            content: [{ text: `EMAIL CONTENT:\n${emailText}\n\n${SYSTEM_INSTRUCTION}` }],
        });
    }

    const command = new ConverseCommand({
        modelId: BEDROCK_MODEL_ID,
        system: [{ text: "You are an expert CA/tax consultant returning structured JSON only. No markdown, no commentary." }],
        messages,
        inferenceConfig: { temperature: 0.0, maxTokens: 2048 },
    });

    const response = await bedrock.send(command);
    const rawResponse = response.output?.message?.content?.[0]?.text ?? "";
    // Strip any accidental markdown code fences
    const cleaned = rawResponse.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
    if (!cleaned) throw new Error("[Bedrock] Empty response from model");
    const data = JSON.parse(cleaned) as NoticeExtraction;

    return {
        data,
        confidence: calculateConfidence(data),
        provider: "bedrock",
        processingTime: Date.now() - startTime,
    };
}

// ─── Google Gemini Implementation ──────────────────────────────────────────────

async function extractWithGemini(
    fileUrl: string | null,
    startTime: number,
    emailText?: string
): Promise<ExtractionResult> {
    let parts: any[] = [];

    if (fileUrl && fileUrl.startsWith("data:")) {
        const commaIdx = fileUrl.indexOf(",");
        const header = fileUrl.substring(5, commaIdx);
        const mimeType = header.split(";")[0] ?? "application/pdf";
        const base64Data = fileUrl.substring(commaIdx + 1);

        parts.push({
            inlineData: {
                data: base64Data,
                mimeType,
            },
        });
        parts.push({ text: emailText ? `EMAIL CONTEXT:\n${emailText}\n\n${SYSTEM_INSTRUCTION}` : SYSTEM_INSTRUCTION });
    } else if (fileUrl) {
        parts.push({ text: `Document URL: ${fileUrl}` + (emailText ? `\n\nEMAIL CONTENT:\n${emailText}` : "") + `\n\n${SYSTEM_INSTRUCTION}` });
    } else if (emailText) {
        parts.push({ text: `EMAIL CONTENT:\n${emailText}\n\n${SYSTEM_INSTRUCTION}` });
    }

    const response = await gemini.models.generateContent({
        model: GEMINI_MODEL_ID,
        contents: [{ role: "user", parts }],
        config: {
            temperature: 0.0,
            responseMimeType: "application/json",
        },
    });

    const rawResponse = response.text || "";
    const data = JSON.parse(rawResponse) as NoticeExtraction;

    return {
        data,
        confidence: calculateConfidence(data),
        provider: "gemini",
        processingTime: Date.now() - startTime,
    };
}

// ─── Mock Fallback ─────────────────────────────────────────────────────────────

function extractMockData(startTime: number): ExtractionResult {
    return {
        data: {
            authority: "GST Department, Maharashtra",
            noticeType: "Show Cause Notice",
            amount: 250000, // stored in INR (will be multiplied by 100 later)
            deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] ?? null,
            section: "Section 74 of CGST Act, 2017",
            financialYear: "2023-24",
            summary: "GST Department issued a show cause notice demanding ₹2,50,000 for alleged ITC mismatch in FY 2023-24.",
            nextSteps: "• Review the notice thoroughly\n• Check the ITC ledger\n• Prepare a draft reply",
            requiredDocuments: "• GSTR-2A/2B reconciliations\n• Purchase invoices for disputed amount\n• Bank statements showing payment to suppliers",
            extractedPan: "ABCDE1234F",
            extractedGstin: "27ABCDE1234F1Z5",
            extractedBusinessName: "Acme Corp India",
            extractedContactName: "John Doe",
            isIntimation: false,
            isTranslated: false,
            originalLanguage: null,
            riskLevel: "high",
        },
        confidence: "medium",
        provider: "mock",
        processingTime: Date.now() - startTime,
    };
}

// ─── Confidence scoring ───────────────────────────────────────────────────────

function calculateConfidence(data: NoticeExtraction): "high" | "medium" | "low" {
    // Tier-1: critical identification fields (weighted 2 points each)
    const criticalFields = [
        data.authority,
        data.noticeType,
        data.extractedGstin ?? data.extractedPan, // At least one ID
        data.deadline,
    ];
    // Tier-2: detail fields (1 point each)
    const detailFields = [
        data.section,
        data.amount,
        data.financialYear,
        data.summary && data.summary.length > 50 ? data.summary : null,
        data.extractedBusinessName,
    ];

    const criticalScore = criticalFields.filter((f) => f !== null && f !== undefined).length * 2;
    const detailScore = detailFields.filter((f) => f !== null && f !== undefined).length;
    const maxScore = criticalFields.length * 2 + detailFields.length; // 8 + 5 = 13
    const ratio = (criticalScore + detailScore) / maxScore;

    if (ratio >= 0.75) return "high";
    if (ratio >= 0.45) return "medium";
    return "low";
}

// ─── Document Translation (via AWS Bedrock Nova Pro) ────────────────────────────

export async function translateNoticeDocument(fileUrl: string): Promise<string> {
    try {
        const TRANSLATE_PROMPT = `You are a professional document translator. Translate the entire content of this document into clear, accurate English. Preserve the original structure, headings, and formatting as much as possible. Provide ONLY the English translation — no commentary, no preamble.`;

        const messages: Message[] = [];

        if (fileUrl.startsWith("data:")) {
            const commaIdx = fileUrl.indexOf(",");
            const header = fileUrl.substring(5, commaIdx);
            const mimeType = header.split(";")[0] ?? "application/pdf";
            const base64Data = fileUrl.substring(commaIdx + 1);

            const binaryStr = atob(base64Data);
            const bytes = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) {
                bytes[i] = binaryStr.charCodeAt(i)!;
            }

            if (mimeType === "application/pdf") {
                messages.push({
                    role: "user",
                    content: [
                        { document: { name: "notice", format: "pdf", source: { bytes } } },
                        { text: TRANSLATE_PROMPT },
                    ],
                });
            } else {
                const imgFormat = mimeType.replace("image/", "") as "png" | "jpeg" | "gif" | "webp";
                messages.push({
                    role: "user",
                    content: [
                        { image: { format: imgFormat, source: { bytes } } },
                        { text: TRANSLATE_PROMPT },
                    ],
                });
            }
        } else {
            // Fallback: just ask Bedrock with the URL in text (for plain-text or edge cases)
            messages.push({
                role: "user",
                content: [{ text: `Document URL: ${fileUrl}\n\n${TRANSLATE_PROMPT}` }],
            });
        }

        const command = new ConverseCommand({
            modelId: BEDROCK_MODEL_ID,
            system: [{ text: "You are a professional multilingual document translator." }],
            messages,
            inferenceConfig: { temperature: 0.1, maxTokens: 4096 },
        });

        const response = await bedrock.send(command);
        const translation = response.output?.message?.content?.[0]?.text?.trim() ?? "";

        if (!translation) throw new Error("Bedrock returned empty translation.");
        return translation;
    } catch (e) {
        console.error("[Translation/Bedrock] Failed to translate document:", e);
        throw new Error("Failed to translate document. Please try again.");
    }
}

// ─── Draft Response Generator (Epic 7) ──────────────────────────────────────────

export async function generateDraftResponse(
    fileUrl: string,
    noticeData: { type: string; authority: string; amount: string; deadline: string; gstin: string; summary?: string }
): Promise<{ actionPlan: string; draftLetter: string }> {
    try {
        const hasDocument = fileUrl && fileUrl !== "#";
        const DRAFT_PROMPT = `You are an expert Indian Tax Consultant / Chartered Accountant.
Your task is to analyze the following tax notice ${hasDocument ? "document" : "details"} and generate a highly professional, legally sound Draft Response and an Action Plan for the client.

Notice Context:
- Type: ${noticeData.type}
- Authority: ${noticeData.authority}
- Demanded Amount: ${noticeData.amount}
- Deadline: ${noticeData.deadline}
- Client GSTIN: ${noticeData.gstin}
${noticeData.summary ? `- Notice Summary: ${noticeData.summary}\n` : ""}
Output your response STRICTLY as a valid JSON object with the following two keys. Do not wrap the JSON in markdown formatting blocks (\`\`\`json). Just return the raw JSON:

{
  "actionPlan": "A string containing a bulleted list (in Markdown) of 2-4 immediate steps the client/CA must take (e.g., specific documents to gather, ledgers to reconcile).",
  "draftLetter": "A string containing a formal, complete letter (in Markdown) addressed to the issuing authority. Use placeholders like [Insert Date] where necessary. Keep the letter concise and focused on the core issues. Include subject line and formal sign-offs."
}`;

        const messages: Message[] = [];

        if (hasDocument && fileUrl.startsWith("data:")) {
            const commaIdx = fileUrl.indexOf(",");
            const header = fileUrl.substring(5, commaIdx);
            const mimeType = header.split(";")[0] ?? "application/pdf";
            const base64Data = fileUrl.substring(commaIdx + 1);

            const binaryStr = atob(base64Data);
            const bytes = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) {
                bytes[i] = binaryStr.charCodeAt(i)!;
            }

            if (mimeType === "application/pdf") {
                messages.push({
                    role: "user",
                    content: [
                        { document: { name: "notice", format: "pdf", source: { bytes } } },
                        { text: DRAFT_PROMPT },
                    ],
                });
            } else {
                const imgFormat = mimeType.replace("image/", "") as "png" | "jpeg" | "gif" | "webp";
                messages.push({
                    role: "user",
                    content: [
                        { image: { format: imgFormat, source: { bytes } } },
                        { text: DRAFT_PROMPT },
                    ],
                });
            }
        } else if (hasDocument) {
            messages.push({
                role: "user",
                content: [{ text: `Document URL: ${fileUrl}\n\n${DRAFT_PROMPT}` }],
            });
        } else {
            // Text-only mode for intimations
            messages.push({
                role: "user",
                content: [{ text: DRAFT_PROMPT }],
            });
        }

        const command = new ConverseCommand({
            modelId: BEDROCK_MODEL_ID,
            system: [{ text: "You are an expert, professional tax consultant drafting legal replies." }],
            messages,
            inferenceConfig: { temperature: 0.2, maxTokens: 4096 },
        });

        const response = await bedrock.send(command);
        let draftText = response.output?.message?.content?.[0]?.text?.trim() ?? "";

        if (!draftText) throw new Error("Bedrock returned empty draft response.");

        if (draftText.startsWith("\`\`\`json")) {
            draftText = draftText.substring(7);
        } else if (draftText.startsWith("\`\`\`")) {
            draftText = draftText.substring(3);
        }
        if (draftText.endsWith("\`\`\`")) {
            draftText = draftText.substring(0, draftText.length - 3);
        }
        draftText = draftText.trim();

        try {
            const parsed = JSON.parse(draftText) as { actionPlan?: string; draftLetter?: string };
            return {
                actionPlan: parsed.actionPlan ?? "No action plan generated.",
                draftLetter: parsed.draftLetter ?? "No draft letter generated."
            };
        } catch (err) {
            console.error("Failed to parse Bedrock JSON response:", draftText, err);
            throw new Error("Invalid response format from AI.");
        }
    } catch (e) {
        console.error("[DraftResponse/Bedrock] Failed to generate draft:", e);
        throw new Error("Failed to generate draft response. Please try again.");
    }
}

// ─── Action Summary ──────────────────────────────────────────────────────────

export async function summarizeActionText(text: string): Promise<string | null> {
    try {
        const response = await gemini.models.generateContent({
            model: GEMINI_MODEL_ID,
            contents: [{ role: "user", parts: [{ text: `You are an expert at summarizing long email threads or action logs into a single brief sentence. Provide ONLY the 1-sentence summary of the following text, with no markdown or intro text:\n\n${text}` }] }],
            config: {
                temperature: 0.1,
                maxOutputTokens: 100,
            },
        });
        return response.text?.trim() || null;
    } catch (e) {
        console.error("[Action Summary] Failed to summarize text:", e);
        return null; // degrade gracefully
    }

}

// ─── Bulletproof Dossier Summary ─────────────────────────────────────────────

export async function generateDossierSummary(
    notice: any,
    auditLogs: any[],
    comments: any[]
): Promise<string | null> {
    try {
        const prompt = `You are a Senior AI Compliance Auditor. 
Your task is to review the end-to-end lifecycle of a tax/statutory notice and provide a definitive "AI Audit Analysis".

NOTICE DATA:
- Type: ${notice.noticeType}
- Authority: ${notice.authority}
- Final Status: ${notice.status}
- Demand Amount: ${notice.amount ? `₹${(notice.amount / 100).toLocaleString("en-IN")}` : "None"}

ACTIVITY TRAIL:
${auditLogs.map((log: any) => `- [${new Date(log.createdAt).toLocaleDateString()}] Action: ${log.action} | Detail: ${log.newValue || "Standard Action"}`).join('\n')}

STAFF NOTES:
${comments.map((c: any) => `- ${c.content}`).join('\n')}

INSTRUCTIONS:
Provide a 2-para professional synthesis covering:
1. **Procedural Integrity**: Did the team follow the correct steps? (Ingestion -> AI Extraction -> Verification -> Resolution).
2. **Defensibility Verdict**: Based on the audit trail and proof, is the resolution (e.g., closing/payment) legally sound? 
3. **Pine Labs Settlement**: If a payment was made via the gateway, explicitly verify its settlement in the audit trail.

Format: Return a professional, objective analysis. No intro like "Here is the summary". Start directly.`;

        const response = await gemini.models.generateContent({
            model: GEMINI_MODEL_ID,
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: {
                temperature: 0.1,
                maxOutputTokens: 500,
            },
        });

        return response.text?.trim() || null;
    } catch (e) {
        console.error("[Dossier Summary] Failed to generate AI Audit Analysis:", e);
        return null;
    }
}
