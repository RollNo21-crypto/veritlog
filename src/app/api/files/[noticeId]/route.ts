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
    { params }: { params: Promise<{ noticeId: string }> }
) {
    const session = await auth();

    if (!session?.userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { noticeId } = await params;

    // The param is the URL-encoded S3 key: tenant/noticeId/filename.pdf
    const fileKey = decodeURIComponent(noticeId);

    try {
        // Generate a 1-hour presigned URL and redirect — no streaming needed
        const presignedUrl = await getPresignedUrl(fileKey, 3600);
        return NextResponse.redirect(presignedUrl);
    } catch (error) {
        console.error("File proxy error:", error);
        return NextResponse.json({ error: "Failed to retrieve file" }, { status: 500 });
    }
}
