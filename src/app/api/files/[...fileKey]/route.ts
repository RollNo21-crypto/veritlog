import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getFileObject } from "~/server/services/storage";

/**
 * Secure file proxy — proxies the file stream directly from S3.
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

    const fileKey = Array.isArray(keyParts) ? keyParts.join("/") : keyParts;

    try {
        const fileObj = await getFileObject(fileKey);

        if (!fileObj.Body) {
            return new NextResponse("Not Found", { status: 404 });
        }

        return new NextResponse(fileObj.Body.transformToWebStream(), {
            headers: {
                "Content-Type": fileObj.ContentType ?? "application/octet-stream",
                ...(fileObj.ContentLength ? { "Content-Length": fileObj.ContentLength.toString() } : {}),
                "Cache-Control": "public, max-age=3600",
            },
        });
    } catch (error) {
        console.error("File proxy error:", error);
        return NextResponse.json({ error: "Failed to retrieve file" }, { status: 500 });
    }
}
