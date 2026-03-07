import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getPresignedUrl } from "~/server/services/storage";

/**
 * Secure file proxy — generates a short-lived presigned S3 URL and redirects.
 * Route: GET /api/files/[noticeId]
 * The [noticeId] segment is actually the URL-encoded S3 file key.
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ fileKey: string | string[] }> }
) {
    const session = await auth();

    if (!session?.userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolvedParams = await params;
    const keyParts = resolvedParams.fileKey;

    // The param is the unencoded S3 key split by slashes: ['tenant', 'noticeId', 'filename.pdf']
    const fileKey = Array.isArray(keyParts) ? keyParts.join("/") : keyParts;

    try {
        // Generate a 1-hour presigned URL and redirect — no streaming needed
        const presignedUrl = await getPresignedUrl(fileKey, 3600);
        return NextResponse.redirect(presignedUrl);
    } catch (error) {
        console.error("File proxy error:", error);
        return NextResponse.json({ error: "Failed to retrieve file" }, { status: 500 });
    }
}
