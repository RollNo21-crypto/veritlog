/**
 * S3 Storage Service — AWS S3 (replaces Cloudflare R2)
 * Handles file upload/download/presigned URLs via @aws-sdk.
 *
 * Configuration is via environment variables:
 *   AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_BUCKET_NAME
 */

import { S3Client, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export interface S3UploadResult {
    fileUrl: string;
    fileKey: string;
    fileHash: string;
}

/**
 * Singleton S3 client — configured from env vars at module load time.
 */
const s3 = new S3Client({
    region: process.env.AWS_REGION ?? "ap-south-1",
    // Explicit regional endpoint prevents PermanentRedirect errors for non-us-east-1 buckets
    endpoint: `https://s3.${process.env.AWS_REGION ?? "ap-south-1"}.amazonaws.com`,
    forcePathStyle: false, // Virtual-hosted-style URLs (default for AWS S3)
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
});

const BUCKET = process.env.S3_BUCKET_NAME!;

/**
 * Upload a file buffer to S3 and return metadata.
 * Uses multipart upload via `@aws-sdk/lib-storage` for reliability on large files.
 */
export async function uploadToS3(
    fileKey: string,
    fileBuffer: ArrayBuffer,
    contentType: string
): Promise<S3UploadResult> {
    // Compute SHA-256 hash for integrity tracking (NFR13)
    const hashBuffer = await crypto.subtle.digest("SHA-256", fileBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const fileHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    const upload = new Upload({
        client: s3,
        params: {
            Bucket: BUCKET,
            Key: fileKey,
            Body: Buffer.from(fileBuffer),
            ContentType: contentType,
            Metadata: { sha256: fileHash },
            // Objects are private by default — access via presigned URLs or proxy
        },
    });

    await upload.done();

    // Files are private; access is via the proxy route or presigned URLs
    const fileUrl = getFileViewUrl(fileKey);

    return { fileUrl, fileKey, fileHash };
}

/**
 * Delete a file from S3 (for hard deletes, e.g. test cleanup only).
 * In production, use soft-deletes on the DB record instead.
 */
export async function deleteFromS3(fileKey: string): Promise<void> {
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: fileKey }));
}

/**
 * Generate a presigned URL for secure, time-limited direct access to a file.
 * Expires in 1 hour by default.
 */
export async function getPresignedUrl(fileKey: string, expiresInSeconds = 3600): Promise<string> {
    const command = new GetObjectCommand({ Bucket: BUCKET, Key: fileKey });
    return getSignedUrl(s3, command, { expiresIn: expiresInSeconds });
}

/**
 * Return the internal proxy URL for viewing a file through the Next.js API route.
 * The API route validates Clerk session before retrieving from S3.
 */
export function getFileViewUrl(fileKey: string): string {
    const encodedKey = fileKey.split('/').map(p => encodeURIComponent(p)).join('/');
    return `/api/files/${encodedKey}`;
}

/**
 * Convert a base64 data URL to an ArrayBuffer for S3 upload.
 */
export function dataUrlToBuffer(dataUrl: string): { buffer: ArrayBuffer; contentType: string } {
    const [header, base64Data] = dataUrl.split(",");
    const contentType = (header ?? "").match(/:(.*?);/)?.[1] ?? "application/octet-stream";
    const binaryStr = atob(base64Data ?? "");
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i)!;
    }
    return { buffer: bytes.buffer, contentType };
}
