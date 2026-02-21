import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// ─── Tenants (CA Firms) ───────────────────────────────────────────────────────
export const tenants = sqliteTable("tenants", {
    id: text("id").primaryKey(), // Clerk Org ID
    name: text("name").notNull(),
    plan: text("plan").notNull().default("free"),
    createdAt: integer("created_at", { mode: "timestamp" })
        .default(sql`(unixepoch())`)
        .notNull(),
});

// ─── Clients (Business entities managed by a CA) ──────────────────────────────
export const clients = sqliteTable("clients", {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
        .notNull()
        .references(() => tenants.id),
    businessName: text("business_name").notNull(),
    gstin: text("gstin"),
    pan: text("pan"),
    contactName: text("contact_name"),
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),
    createdAt: integer("created_at", { mode: "timestamp" })
        .default(sql`(unixepoch())`)
        .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" })
        .default(sql`(unixepoch())`)
        .notNull(),
});

// ─── Notices (Core domain entity) ─────────────────────────────────────────────
export const notices = sqliteTable("notices", {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
        .notNull()
        .references(() => tenants.id),
    clientId: text("client_id")
        .references(() => clients.id),

    // File metadata
    fileName: text("file_name"),
    fileUrl: text("file_url"),
    fileSize: integer("file_size"),
    fileHash: text("file_hash"), // SHA-256 for integrity (NFR13)

    // AI-extracted fields
    authority: text("authority"),
    noticeType: text("notice_type"),
    amount: integer("amount"), // stored in paise (×100)
    deadline: text("deadline"), // ISO date string
    section: text("section"),
    financialYear: text("financial_year"),
    summary: text("summary"), // LLM-generated plain-language summary

    // AI confidence & risk
    confidence: text("confidence"), // "high" | "medium" | "low"
    riskLevel: text("risk_level"), // "high" | "medium" | "low"

    // Workflow
    status: text("status").notNull().default("processing"),
    // "processing" | "review_needed" | "verified" | "in_progress" | "closed"
    source: text("source").notNull().default("upload"), // "upload" | "email"
    assignedTo: text("assigned_to"), // Clerk user ID
    verifiedBy: text("verified_by"), // Clerk user ID
    verifiedAt: integer("verified_at", { mode: "timestamp" }),
    closedAt: integer("closed_at", { mode: "timestamp" }),
    closedBy: text("closed_by"),

    // Soft delete (NFR12 — 7-year retention)
    deletedAt: integer("deleted_at", { mode: "timestamp" }),

    // Timestamps
    createdAt: integer("created_at", { mode: "timestamp" })
        .default(sql`(unixepoch())`)
        .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" })
        .default(sql`(unixepoch())`)
        .notNull(),
});

// ─── Notice Comments ──────────────────────────────────────────────────────────
export const comments = sqliteTable("comments", {
    id: text("id").primaryKey(),
    noticeId: text("notice_id")
        .notNull()
        .references(() => notices.id),
    tenantId: text("tenant_id")
        .notNull()
        .references(() => tenants.id),
    userId: text("user_id").notNull(), // Clerk user ID
    content: text("content").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
        .default(sql`(unixepoch())`)
        .notNull(),
});

// ─── Notice Attachments (proof of filing / response docs) ─────────────────────
export const attachments = sqliteTable("attachments", {
    id: text("id").primaryKey(),
    noticeId: text("notice_id")
        .notNull()
        .references(() => notices.id),
    tenantId: text("tenant_id")
        .notNull()
        .references(() => tenants.id),
    userId: text("user_id").notNull(),
    fileName: text("file_name").notNull(),
    fileUrl: text("file_url").notNull(),
    fileSize: integer("file_size"),
    fileHash: text("file_hash"),
    createdAt: integer("created_at", { mode: "timestamp" })
        .default(sql`(unixepoch())`)
        .notNull(),
});

// ─── Audit Logs (Immutable, append-only) ──────────────────────────────────────
export const auditLogs = sqliteTable("audit_logs", {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
        .notNull()
        .references(() => tenants.id),
    userId: text("user_id").notNull(),
    action: text("action").notNull(),
    // "notice.created" | "notice.updated" | "notice.verified" | "notice.assigned"
    // "notice.closed" | "notice.viewed" | "comment.added" | "attachment.added"
    entityType: text("entity_type").notNull(), // "notice" | "client" | "attachment"
    entityId: text("entity_id").notNull(),
    previousValue: text("previous_value"), // JSON string of old values
    newValue: text("new_value"), // JSON string of new values
    ipAddress: text("ip_address"),
    createdAt: integer("created_at", { mode: "timestamp" })
        .default(sql`(unixepoch())`)
        .notNull(),
});
