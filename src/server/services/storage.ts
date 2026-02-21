/**
 * R2 Storage Service
 * Handles file upload/download to/from Cloudflare R2.
 *
 * In Cloudflare Pages, R2 is accessed via `platform.env.R2`.
 * For local dev, files are stored as base64 data URLs (no R2 needed).
 */

export interface R2UploadResult {
    fileUrl: string;
    fileKey: string;
    fileHash: string;
}

/**
 * Upload a file buffer to R2 and return its public URL.
 * Falls back to a data URL approach when R2 is unavailable (local dev).
 */
export async function uploadToR2(
    r2: R2Bucket | null | undefined,
    fileKey: string,
    fileBuffer: ArrayBuffer,
    contentType: string
): Promise<R2UploadResult> {
    // Compute SHA-256 hash for integrity tracking (NFR13)
    const hashBuffer = await crypto.subtle.digest("SHA-256", fileBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const fileHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    if (r2) {
        // Production: store on Cloudflare R2
        await r2.put(fileKey, fileBuffer, {
            httpMetadata: { contentType },
            customMetadata: { sha256: fileHash },
        });

        // R2 public URL — requires a custom domain or R2 public access configured
        const fileUrl = `https://storage.veritlog.in/${fileKey}`;

        return { fileUrl, fileKey, fileHash };
    } else {
        // Development fallback — return a placeholder URL
        console.warn("[R2] No R2 binding found. Using placeholder URL for dev.");
        const fileUrl = `data:${contentType};base64-placeholder/${fileKey}`;
        return { fileUrl, fileKey, fileHash };
    }
}

/**
 * Delete a file from R2 (for hard deletes, e.g. test cleanup only).
 * In production, use soft-deletes on the DB record instead.
 */
export async function deleteFromR2(
    r2: R2Bucket | null | undefined,
    fileKey: string
): Promise<void> {
    if (r2) {
        await r2.delete(fileKey);
    }
}

/**
 * Generate a signed/temporary URL for viewing a file.
 * R2 doesn't natively support presigned URLs yet, so we proxy through a
 * Next.js API route that validates Clerk session before streaming.
 */
export function getFileViewUrl(noticeId: string): string {
    return `/api/files/${noticeId}`;
}

/**
 * Convert a base64 data URL to an ArrayBuffer for R2 upload.
 */
export function dataUrlToBuffer(dataUrl: string): { buffer: ArrayBuffer; contentType: string } {
    const [header, base64Data] = dataUrl.split(",");
    const contentType = (header ?? "").match(/:(.*?);/)?.[1] ?? "application/octet-stream";
    const binaryStr = atob(base64Data ?? "");
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
    }
    return { buffer: bytes.buffer, contentType };
}
