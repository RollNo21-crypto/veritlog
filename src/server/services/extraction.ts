/**
 * AI Extraction Service
 * Extracts structured data from tax notice documents
 * Supports: AWS Textract, Google Document AI, or OpenAI Vision
 */

export interface NoticeExtraction {
    authority: string | null;
    noticeType: string | null;
    amount: number | null;
    deadline: string | null; // ISO date
    section: string | null;
    financialYear: string | null;
    rawText?: string;
}

export interface ExtractionResult {
    data: NoticeExtraction;
    confidence: "high" | "medium" | "low";
    processingTime: number;
}

/**
 * Extract structured data from a document URL
 * @param fileUrl - R2 URL or base64 data URI
 * @param provider - AI service to use
 */
export async function extractNoticeData(
    fileUrl: string,
    provider: "openai" | "textract" | "mock" = "mock"
): Promise<ExtractionResult> {
    const startTime = Date.now();

    try {
        switch (provider) {
            case "openai":
                return await extractWithOpenAI(fileUrl, startTime);
            case "textract":
                return await extractWithTextract(fileUrl, startTime);
            case "mock":
            default:
                return extractMockData(startTime);
        }
    } catch (error) {
        console.error("Extraction failed:", error);
        throw new Error("Failed to extract notice data");
    }
}

/**
 * OpenAI Vision API extraction
 */
async function extractWithOpenAI(
    fileUrl: string,
    startTime: number
): Promise<ExtractionResult> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error("OPENAI_API_KEY not configured");
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: `You are an expert at extracting structured data from Indian tax notices. Extract the following fields in JSON format:
- authority: Issuing authority (e.g., "GST Department", "Income Tax Department")
- noticeType: Type of notice (e.g., "Show Cause Notice", "Demand Notice")
- amount: Amount in INR (number only)
- deadline: Response deadline (ISO date format YYYY-MM-DD)
- section: Relevant section/act (e.g., "Section 74 of CGST Act")
- financialYear: Financial year (e.g., "2023-24")

Return ONLY valid JSON. If a field cannot be determined, use null.`,
                },
                {
                    role: "user",
                    content: [
                        {
                            type: "image_url",
                            image_url: { url: fileUrl },
                        },
                        {
                            type: "text",
                            text: "Extract the notice data from this document.",
                        },
                    ],
                },
            ],
            max_tokens: 500,
            temperature: 0.1,
        }),
    });

    if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const result = await response.json();
    const content = result.choices[0]?.message?.content;

    if (!content) {
        throw new Error("No content in OpenAI response");
    }

    const data = JSON.parse(content) as NoticeExtraction;

    return {
        data,
        confidence: calculateConfidence(data),
        processingTime: Date.now() - startTime,
    };
}

/**
 * AWS Textract extraction (placeholder)
 */
async function extractWithTextract(
    fileUrl: string,
    startTime: number
): Promise<ExtractionResult> {
    // TODO: Implement AWS Textract integration
    throw new Error("Textract integration not yet implemented");
}

/**
 * Mock extraction for development
 */
function extractMockData(startTime: number): ExtractionResult {
    return {
        data: {
            authority: "GST Department, Maharashtra",
            noticeType: "Show Cause Notice",
            amount: 250000,
            deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // 30 days from now
            section: "Section 74 of CGST Act, 2017",
            financialYear: "2023-24",
        },
        confidence: "medium",
        processingTime: Date.now() - startTime,
    };
}

/**
 * Calculate confidence score based on extracted data completeness
 */
function calculateConfidence(data: NoticeExtraction): "high" | "medium" | "low" {
    const fields = [
        data.authority,
        data.noticeType,
        data.amount,
        data.deadline,
        data.section,
    ];

    const filledFields = fields.filter((f) => f !== null && f !== undefined).length;
    const completeness = filledFields / fields.length;

    if (completeness >= 0.8) return "high";
    if (completeness >= 0.5) return "medium";
    return "low";
}
