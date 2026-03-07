/**
 * Secure share-token service for WhatsApp deep-links (Story 5.4)
 *
 * Tokens are HMAC-signed JWTs stored in the DB-free way:
 *   payload = { noticeId, tenantId, exp }
 *   token   = base64url(payload) + "." + HMAC-SHA256(base64url(payload), SHARE_TOKEN_SECRET)
 *
 * Required env var:  SHARE_TOKEN_SECRET  (any long random string)
 */

import { createHmac } from "crypto";

const SECRET = process.env.SHARE_TOKEN_SECRET ?? "dev-secret-change-in-prod";
const TTL_MINUTES = 60 * 24 * 7; // 7 days

type TokenPayload = {
    noticeId: string;
    tenantId: string;
    exp: number; // unix ms
};

function b64url(s: string): string {
    return Buffer.from(s).toString("base64url");
}

function sign(data: string): string {
    return createHmac("sha256", SECRET).update(data).digest("base64url");
}

/**
 * Generate a secure 7-day share token for a notice
 */
export function generateShareToken(noticeId: string, tenantId: string): string {
    const payload: TokenPayload = {
        noticeId,
        tenantId,
        exp: Date.now() + TTL_MINUTES * 60 * 1000,
    };
    const encoded = b64url(JSON.stringify(payload));
    const sig = sign(encoded);
    return `${encoded}.${sig}`;
}

/**
 * Verify and decode a share token.
 * Returns the payload or null if invalid/expired.
 */
export function verifyShareToken(token: string): TokenPayload | null {
    try {
        const dot = token.lastIndexOf(".");
        if (dot === -1) return null;
        const encoded = token.slice(0, dot);
        const sig = token.slice(dot + 1);
        if (sign(encoded) !== sig) return null;
        const payload = JSON.parse(Buffer.from(encoded, "base64url").toString()) as TokenPayload;
        if (Date.now() > payload.exp) return null;
        return payload;
    } catch {
        return null;
    }
}
