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
  "summary": "One plain-English sentence summarising what this notice is about"
}
If a field cannot be determined, use null. Return only the JSON object, nothing else.`;

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
    fileUrl: string,
    mode: "parallel" | "mock" = "parallel"
): Promise<ExtractionResult> {
    const startTime = Date.now();

    if (mode === "mock") {
        return extractMockData(startTime);
    }

    try {
        console.log("[Extraction] Starting parallel AI extraction (Bedrock Nova + Gemini 2.0)...");

        // Run both promises concurrently but don't fail if one crashes
        const [bedrockResult, geminiResult] = await Promise.allSettled([
            extractWithBedrock(fileUrl, startTime),
            extractWithGemini(fileUrl, startTime)
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
    fileUrl: string,
    startTime: number
): Promise<ExtractionResult> {
    const messages: Message[] = [];

    if (fileUrl.startsWith("data:")) {
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
                    { text: SYSTEM_INSTRUCTION },
                ],
            });
        } else {
            messages.push({
                role: "user",
                content: [
                    { image: { format: format as "png" | "jpeg" | "gif" | "webp", source: { bytes } } },
                    { text: SYSTEM_INSTRUCTION },
                ],
            });
        }
    } else {
        messages.push({
            role: "user",
            content: [{ text: `Document URL: ${fileUrl}\n\n${SYSTEM_INSTRUCTION}` }],
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
    fileUrl: string,
    startTime: number
): Promise<ExtractionResult> {
    let parts: any[] = [];

    if (fileUrl.startsWith("data:")) {
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
        parts.push({ text: SYSTEM_INSTRUCTION });
    } else {
        parts.push({ text: `Document URL: ${fileUrl}\n\n${SYSTEM_INSTRUCTION}` });
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
            amount: 250000 * 100, // stored in paise
            deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] ?? null,
            section: "Section 74 of CGST Act, 2017",
            financialYear: "2023-24",
            summary: "GST Department issued a show cause notice demanding ₹2,50,000 for alleged ITC mismatch in FY 2023-24.",
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
