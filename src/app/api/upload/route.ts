import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { uploadToS3 } from "~/server/services/storage";

export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;
        const noticeId = formData.get("noticeId") as string | null;

        if (!file || !noticeId) {
            return NextResponse.json({ error: "Missing file or noticeId" }, { status: 400 });
        }

        const buffer = await file.arrayBuffer();

        // Use the tenant ID (userId from Clerk) to scope the S3 key structure
        const tenantId = session.userId;
        const fileKey = `${tenantId}/${noticeId}/responses/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;

        const result = await uploadToS3(fileKey, buffer, file.type);

        return NextResponse.json({
            fileName: file.name,
            fileSize: file.size,
            ...result,
        });
    } catch (error) {
        console.error("Upload error:", error);
        return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
}
