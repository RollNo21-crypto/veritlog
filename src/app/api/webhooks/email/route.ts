import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";

/**
 * Email Ingestion Webhook
 * Receives forwarded emails from SendGrid/Mailgun
 * Extracts metadata and creates Notice records
 */
export async function POST(req: NextRequest) {
    try {
        // TODO: Verify webhook signature for security
        const headersList = await headers();
        const contentType = headersList.get("content-type");

        // Parse email payload (format depends on provider)
        const body = await req.json();

        // Extract email metadata
        const emailData = {
            from: body.from || body.sender,
            subject: body.subject,
            date: body.date || new Date().toISOString(),
            to: body.to,
            attachments: body.attachments || [],
        };

        // TODO: Map email address to tenant
        // For now, we'll extract from the "to" field (e.g., notices+tenant123@veritlog.in)
        const tenantId = extractTenantFromEmail(emailData.to);

        if (!tenantId) {
            return NextResponse.json(
                { error: "Invalid recipient address" },
                { status: 400 }
            );
        }

        // TODO: Upload attachments to R2
        // TODO: Create Notice record in D1
        // TODO: Trigger AI extraction pipeline

        console.log("Email received:", {
            from: emailData.from,
            subject: emailData.subject,
            tenantId,
            attachmentCount: emailData.attachments.length,
        });

        return NextResponse.json({
            success: true,
            message: "Email processed successfully",
            noticeId: "placeholder-id", // TODO: Return actual notice ID
        });
    } catch (error) {
        console.error("Email webhook error:", error);
        return NextResponse.json(
            { error: "Failed to process email" },
            { status: 500 }
        );
    }
}

/**
 * Extract tenant ID from email address
 * Format: notices+tenant123@veritlog.in -> tenant123
 * Or: notices@veritlog.in with custom domain mapping
 */
function extractTenantFromEmail(email: string): string | null {
    if (!email) return null;

    // Simple extraction from + addressing
    const match = email.match(/notices\+([^@]+)@/);
    if (match) {
        return match[1];
    }

    // TODO: Implement domain-based tenant mapping
    // e.g., notices@client-domain.com -> lookup tenant by domain

    return null;
}
