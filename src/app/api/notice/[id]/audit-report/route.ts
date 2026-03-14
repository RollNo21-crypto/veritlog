import { type NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { db } from "~/server/db";
import { notices, auditLogs, attachments, comments } from "~/server/db/schema";
import { and, eq, isNull, desc } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { generateDossierSummary } from "~/server/services/extraction";

/**
 * Story 6.1 — Audit Report PDF Generation
 * GET /api/notice/[id]/audit-report
 *
 * Returns an HTML "Evidence Packet" designed for browser print-to-PDF.
 * Contains:
 *   - Notice summary & extracted fields
 *   - Full activity timeline (audit log)
 *   - Proof of action attachments list
 *   - SHA-256 integrity hash in the footer
 *
 * Access control: tenant-scoped, requires valid Clerk session.
 */
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const resolvedParams = await params;
    const { userId, orgId } = await auth();

    // ── Load notice ──────────────────────────────────────────────────────────
    const [notice] = await db
        .select()
        .from(notices)
        .where(
            and(
                eq(notices.id, resolvedParams.id),
                isNull(notices.deletedAt)
            )
        )
        .limit(1);

    if (!notice) {
        return new NextResponse("Notice not found", { status: 404 });
    }

    // Authorization: Must be authenticated OR notice must be CLOSED for public access
    const isPublicAccess = notice.status === "closed";
    if (!userId && !isPublicAccess) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    // If authenticated, ensure tenant matches (security)
    // SKIP this check if it's public access (the notice is closed).
    // Otherwise, allow if notice.tenantId matches either the userId or the active orgId.
    if (userId && !isPublicAccess) {
        if (notice.tenantId !== userId && notice.tenantId !== orgId) {
            return new NextResponse("Forbidden", { status: 403 });
        }
    }

    const tenantId = notice.tenantId;

    // ── Load audit trail ─────────────────────────────────────────────────────
    const auditEntries = await db
        .select()
        .from(auditLogs)
        .where(
            and(
                eq(auditLogs.entityId, resolvedParams.id),
                eq(auditLogs.tenantId, tenantId)
            )
        )
        .orderBy(desc(auditLogs.createdAt));

    // ── Load attachments ─────────────────────────────────────────────────────
    const proofDocs = await db
        .select()
        .from(attachments)
        .where(eq(attachments.noticeId, resolvedParams.id));

    // ── Load comments for dossier ────────────────────────────────────────────
    const noticeComments = await db
        .select()
        .from(comments)
        .where(eq(comments.noticeId, resolvedParams.id));

    // ── Generate AI Dossier Summary ──────────────────────────────────────────
    const defenseSummary = await generateDossierSummary(notice, auditEntries, noticeComments);

    // ── SHA-256 integrity hash ────────────────────────────────────────────────
    const content = JSON.stringify({ notice, auditEntries, proofDocs, defenseSummary });
    const integrity = createHash("sha256").update(content).digest("hex");

    // ── Helpers ───────────────────────────────────────────────────────────────
    const fmt = (d: Date | null | undefined) =>
        d ? new Date(d).toLocaleString("en-IN", { dateStyle: "long", timeStyle: "short" }) : "—";
    const rupees = (p: number | null) =>
        p ? `₹${(p / 100).toLocaleString("en-IN")}` : "—";
    const riskColor = (r: string | null) =>
        r === "high" ? "#dc2626" : r === "medium" ? "#d97706" : "#16a34a";

    const ACTION_MAP: Record<string, string> = {
        "notice.created": "Notice Created",
        "notice.verified": "Notice Verified",
        "notice.assigned": "Assigned to Operator",
        "notice.updated": "Fields Updated",
        "notice.closed": "Notice Closed",
        "notice.approved": "Client Approved Response",
        "notice.template_issue_flagged": "Template Issue Flagged",
        "notice.reminder_1d": "Reminder Sent (1 day)",
        "notice.reminder_3d": "Reminder Sent (3 days)",
    };

    const auditRows = auditEntries.map((e) => `
        <tr>
            <td>${fmt(e.createdAt)}</td>
            <td>${ACTION_MAP[e.action] ?? e.action}</td>
            <td style="font-family:monospace;font-size:11px">${(e.userId ?? "system").slice(0, 20)}</td>
            <td style="font-size:11px;color:#6b7280">${e.newValue ? JSON.stringify(JSON.parse(e.newValue), null, 0).slice(0, 80) : "—"}</td>
        </tr>`).join("");

    const attachmentRows = proofDocs.map((a) => `
        <tr>
            <td>${a.fileName ?? "—"}</td>
            <td>${(a.fileName?.split('.').pop() ?? "DOCUMENT").toUpperCase()}</td>
            <td style="font-family:monospace;font-size:11px">${fmt(a.createdAt)}</td>
        </tr>`).join("");

    // ── HTML Report ───────────────────────────────────────────────────────────
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Audit Evidence Packet — ${notice.id}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #111; background: #fff; padding: 40px; }
  @media print {
    body { padding: 20px; }
    .no-print { display: none; }
    @page { margin: 20mm; }
  }
  h1 { font-size: 22px; font-weight: 700; letter-spacing: -0.5px; }
  h2 { font-size: 14px; font-weight: 700; margin: 24px 0 10px; padding-bottom: 4px; border-bottom: 2px solid #e5e7eb; text-transform: uppercase; letter-spacing: 0.05em; color: #374151; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; padding-bottom: 16px; border-bottom: 3px solid #111; }
  .logo { font-size: 20px; font-weight: 900; letter-spacing: 2px; }
  .badge { display: inline-block; padding: 2px 10px; border-radius: 99px; font-size: 11px; font-weight: 700; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .field { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 14px; }
  .field label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; display: block; margin-bottom: 3px; }
  .field span { font-size: 14px; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { background: #f3f4f6; text-align: left; padding: 8px 10px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: #6b7280; }
  td { padding: 8px 10px; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
  tr:last-child td { border-bottom: none; }
  .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; }
  .hash { font-family: monospace; font-size: 10px; word-break: break-all; color: #6b7280; background: #f9fafb; padding: 8px 12px; border-radius: 6px; margin-top: 6px; }
  .print-btn { position: fixed; bottom: 24px; right: 24px; background: #111; color: #fff; border: none; padding: 12px 22px; border-radius: 8px; cursor: pointer; font-weight: 700; font-size: 13px; z-index: 10; }
  .empty { color: #9ca3af; font-style: italic; padding: 16px; text-align: center; }
</style>
</head>
<body>

<button class="print-btn no-print" onclick="window.print()">🖨 Print / Save PDF</button>

<div class="header">
  <div>
    <div class="logo">VERITLOG</div>
    <div style="font-size:12px;color:#6b7280;margin-top:3px">Audit Evidence Packet</div>
  </div>
  <div style="text-align:right">
    <div style="font-size:11px;color:#6b7280">Generated: ${fmt(new Date())}</div>
    <div style="font-size:11px;color:#6b7280;margin-top:2px">Notice ID: <code style="font-family:monospace">${notice.id}</code></div>
  </div>
</div>

<!-- AI Audit Analysis -->
${defenseSummary ? `
<div style="background:#f8fafc; border:2px solid #e2e8f0; border-radius:12px; padding:20px; margin-bottom:24px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
    <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
        <span style="font-size:18px;">🛡️</span>
        <h3 style="font-size:12px; text-transform:uppercase; color:#0f172a; margin:0; font-weight:800; letter-spacing:0.1em">
            Senior AI Compliance Audit
        </h3>
    </div>
    <div style="font-size:13px; color:#334155; line-height:1.6; font-style:italic;">
        ${defenseSummary.split('\n\n').map(p => `<p style="margin-bottom:10px">${p}</p>`).join('')}
    </div>
    <div style="margin-top:12px; padding-top:12px; border-top:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center;">
        <span style="font-size:10px; color:#94a3b8; font-weight:600; text-transform:uppercase;">Automated Synthesis Engine: Gemini 2.0 Flash</span>
        <span style="font-size:10px; padding:2px 8px; background:#f1f5f9; border-radius:4px; font-weight:700; color:#475569;">VERIFIED BY VERITLOG AI</span>
    </div>
</div>` : ""}
<div class="grid">
  <div class="field"><label>Notice Type</label><span>${notice.noticeType ?? "—"}</span></div>
  <div class="field"><label>Issuing Authority</label><span>${notice.authority ?? "—"}</span></div>
  <div class="field"><label>Amount in Dispute</label><span>${rupees(notice.amount)}</span></div>
  <div class="field"><label>Response Deadline</label><span>${notice.deadline ?? "—"}</span></div>
  <div class="field"><label>Section / Provision</label><span>${notice.section ?? "—"}</span></div>
  <div class="field"><label>Financial Year</label><span>${notice.financialYear ?? "—"}</span></div>
  <div class="field"><label>Risk Level</label>
    <span><span class="badge" style="background:${riskColor(notice.riskLevel)}22;color:${riskColor(notice.riskLevel)}">${(notice.riskLevel ?? "low").toUpperCase()}</span></span>
  </div>
  <div class="field"><label>Current Status</label><span>${notice.status.replace(/_/g, " ").toUpperCase()}</span></div>
  <div class="field" style="grid-column:1/-1"><label>AI Confidence</label><span>${notice.confidence ?? "—"}</span></div>
  ${notice.summary ? `<div class="field" style="grid-column:1/-1"><label>AI Summary</label><span style="font-weight:400;font-size:13px">${notice.summary}</span></div>` : ""}
</div>

<!-- File Info -->
<h2>Original Document</h2>
<div class="grid">
  <div class="field"><label>File Name</label><span>${notice.fileName ?? "—"}</span></div>
  <div class="field"><label>Uploaded</label><span>${fmt(notice.createdAt)}</span></div>
  ${notice.fileHash ? `<div class="field" style="grid-column:1/-1"><label>SHA-256 Integrity Hash</label><div class="hash">${notice.fileHash}</div></div>` : ""}
</div>

<!-- Activity Timeline -->
<h2>Activity Timeline (${auditEntries.length} events)</h2>
${auditEntries.length === 0
            ? `<p class="empty">No audit events recorded.</p>`
            : `<table><thead><tr><th>Timestamp</th><th>Action</th><th>User ID</th><th>Details</th></tr></thead><tbody>${auditRows}</tbody></table>`
        }

<!-- Proof of Action Attachments -->
<h2>Proof of Action Documents (${proofDocs.length})</h2>
${proofDocs.length === 0
            ? `<p class="empty">No proof documents attached.</p>`
            : `<table><thead><tr><th>File</th><th>Type</th><th>Uploaded</th></tr></thead><tbody>${attachmentRows}</tbody></table>`
        }

<!-- Footer integrity hash -->
<div class="footer">
  <div>This document was generated automatically by VERITLOG. It is an immutable audit record as per FR25 / NFR13.</div>
  <div style="margin-top:6px">Report integrity hash (SHA-256):</div>
  <div class="hash">${integrity}</div>
  <div style="margin-top:8px;font-size:10px">Report generated: ${new Date().toISOString()} | Notice: ${notice.id} | Tenant: ${tenantId}</div>
</div>

</body>
</html>`;

    return new NextResponse(html, {
        headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Content-Disposition": `inline; filename="audit-report-${notice.id}.html"`,
            "Cache-Control": "no-store",
        },
    });
}
