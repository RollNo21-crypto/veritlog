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

const SYSTEM_INSTRUCTION = `You are an expert at reading Indian tax and regulatory notices (GST, Income Tax, Customs, etc.).
Extract the following fields from the document and return ONLY valid JSON with no markdown or code fences:
{
  "authority": "Issuing authority name, e.g. GST Department Maharashtra",
  "noticeType": "Type of notice, e.g. Show Cause Notice, Demand Notice",
  "amount": <number in INR (paise) or null>,
  "deadline": "Response deadline in YYYY-MM-DD format or null",
  "section": "Relevant section/act e.g. Section 74 of CGST Act 2017 or null",
  "financialYear": "Financial year e.g. 2023-24 or null",
  "nextSteps": "Bullet points detailing the recommended next steps the CA/tax professional should take to resolve or reply to this notice",
  "requiredDocuments": "Bullet points listing exactly what documents or evidence the CA will need to collect from the client to draft the reply",
  "extractedPan": "The 10-character alphanumeric PAN (Permanent Account Number) of the taxpayer mentioned in the document or null",
  "extractedGstin": "The 15-character alphanumeric GSTIN of the taxpayer mentioned in the document or null",
  "extractedBusinessName": "The name of the business or organization the notice is addressed to, or mentioned as the taxpayer",
  "extractedContactName": "The name of the contact person, proprietor, or authorized signatory mentioned in the document",
  "isIntimation": <boolean, true if this is just an email notification without the full document attached, false if it is a complete notice PDF>,
  "isTranslated": <boolean, true if you had to translate the text from a non-English language (e.g. Hindi, Marathi, Tamil) to English>,
  "originalLanguage": "The name of the original language if translated, otherwise null",
  "summary": "A highly detailed, comprehensive paragraph (3-4 sentences) that deeply synthesizes key details from BOTH the email body (if provided) AND the attached document. Do NOT just summarize the email. You must extract the core facts from the attached document (like specific demands, sections, dates, background reasons, and actions required) and merge them with context from the email. Mention specific amounts, deadlines, and the core issue. IF the text was translated from a non-English language to English, you MUST append ' (Translated from [Language])' to the end of your summary. If it was already in English, do not add any note about translation."
}
If a field cannot be determined, use null. Return only the JSON object, nothing else.
IMPORTANT: You may receive both an email body AND an attached document (PDF/Image). Synthesize information from BOTH to provide the best summary and field extraction.
If the notice is in a language other than English, translate the gist to English for the summary and fields, and set 'isTranslated' to true.`;

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
        return extractMockData(startTime);
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
        system: [{ text: "You are a helpful JSON extraction assistant." }],
        messages,
        inferenceConfig: { temperature: 0.0, maxTokens: 512 },
    });

    const response = await bedrock.send(command);
    const rawResponse = response.output?.message?.content?.[0]?.text ?? "";
    const cleaned = rawResponse.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
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
        },
        confidence: "medium",
        provider: "mock",
        processingTime: Date.now() - startTime,
    };
}

// ─── Confidence scoring ───────────────────────────────────────────────────────

function calculateConfidence(data: NoticeExtraction): "high" | "medium" | "low" {
    const keyFields = [
        data.authority,
        data.noticeType,
        data.amount,
        data.deadline,
        data.section,
    ];

    const filled = keyFields.filter((f) => f !== null && f !== undefined).length;
    const ratio = filled / keyFields.length;

    if (ratio >= 0.8) return "high";
    if (ratio >= 0.5) return "medium";
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
        const prompt = `You are an expert tax audit compliance officer.
Please generate a "Defensibility Summary" for this tax notice, based on the following timeline of events and staff comments.
Make it a single paragraph, professional, and focusing on whether the correct steps were taken, the evidence provided, and the final resolution readiness.

Notice Details:
Type: ${notice.noticeType}
Status: ${notice.status}
Amount: ${notice.amount ? notice.amount / 100 : 0}

Timeline (Audit Logs):
${auditLogs.map((log: any) => `- ${new Date(log.createdAt).toISOString().split('T')[0]}: ${log.action}`).join('\n')}

Staff Comments & Notes:
${comments.map((c: any) => `- ${c.content}`).join('\n')}

Generate the concise Defense Summary:`;

        const response = await gemini.models.generateContent({
            model: GEMINI_MODEL_ID,
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: {
                temperature: 0.2,
                maxOutputTokens: 300,
            },
        });

        return response.text?.trim() || null;
    } catch (e) {
        console.error("[Dossier Summary] Failed to generate dossier summary:", e);
        return null;
    }
}
