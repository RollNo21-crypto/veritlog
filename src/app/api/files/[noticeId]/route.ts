import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

/**
 * Secure file proxy route — streams R2 files through the server after
 * validating the Clerk session. This prevents unauthorized access to raw R2 URLs.
 *
 * Route: GET /api/files/[noticeId]
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
    const tenantId = session.orgId;

    if (!tenantId) {
        return NextResponse.json({ error: "No organization selected" }, { status: 400 });
    }

    try {
        let r2: R2Bucket | null = null;

        try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const { getRequestContext } = require("@cloudflare/next-on-pages");
            const ctx = getRequestContext();
            r2 = ctx.env.R2 as R2Bucket;
        } catch {
            // Local dev — R2 not available
        }

        if (!r2) {
            return NextResponse.json(
                { error: "File storage not available in local dev" },
                { status: 503 }
            );
        }

        // List objects for this notice (we may not know the exact file key)
        // Key prefix: {tenantId}/{noticeId}/
        const prefix = `${tenantId}/${noticeId}/`;
        const listed = await r2.list({ prefix });

        if (!listed.objects.length) {
            return NextResponse.json({ error: "File not found" }, { status: 404 });
        }

        // Get the first object (should only be one per notice)
        const key = listed.objects[0]?.key;
        if (!key) {
            return NextResponse.json({ error: "File not found" }, { status: 404 });
        }

        const object = await r2.get(key);

        if (!object) {
            return NextResponse.json({ error: "File not found in storage" }, { status: 404 });
        }

        const contentType = object.httpMetadata?.contentType ?? "application/octet-stream";
        const headers = new Headers();
        headers.set("Content-Type", contentType);
        headers.set("Cache-Control", "private, max-age=3600");
        headers.set("Content-Disposition", `inline; filename="${key.split("/").pop() ?? "file"}"`);

        return new NextResponse(object.body, { headers });
    } catch (error) {
        console.error("File proxy error:", error);
        return NextResponse.json({ error: "Failed to retrieve file" }, { status: 500 });
    }
}
