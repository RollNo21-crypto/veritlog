import { pgTable, text, integer, timestamp, boolean } from "drizzle-orm/pg-core";

// ─── Tenants (CA Firms) ───────────────────────────────────────────────────────
export const tenants = pgTable("tenants", {
    id: text("id").primaryKey(), // Clerk Org ID
    name: text("name").notNull(),
    plan: text("plan").notNull().default("free"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Clients (Business entities managed by a CA) ──────────────────────────────
export const clients = pgTable("clients", {
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
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Notices (Core domain entity) ─────────────────────────────────────────────
export const notices = pgTable("notices", {
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
    nextSteps: text("next_steps"), // AI-suggested next steps for CA
    requiredDocuments: text("required_documents"), // AI-suggested documents to collect

    // AI confidence & risk
    confidence: text("confidence"), // "high" | "medium" | "low"
    riskLevel: text("risk_level"), // "high" | "medium" | "low"

    // Workflow
    status: text("status").notNull().default("processing"),
    // "processing" | "review_needed" | "verified" | "in_progress" | "closed" | "approval_pending" | "approved"
    hasTemplateIssue: boolean("has_template_issue").notNull().default(false),
    isDuplicate: boolean("is_duplicate").notNull().default(false),
    mismatchWarning: text("mismatch_warning"),
    isTranslated: boolean("is_translated").notNull().default(false),
    originalLanguage: text("original_language"),
    source: text("source").notNull().default("upload"), // "upload" | "email"
    assignedTo: text("assigned_to"), // Clerk user ID
    verifiedBy: text("verified_by"), // Clerk user ID
    verifiedAt: timestamp("verified_at"),
    closedAt: timestamp("closed_at"),
    closedBy: text("closed_by"),

    // Soft delete (NFR12 — 7-year retention)
    deletedAt: timestamp("deleted_at"),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Notice Comments ──────────────────────────────────────────────────────────
export const comments = pgTable("comments", {
    id: text("id").primaryKey(),
    noticeId: text("notice_id")
        .notNull()
        .references(() => notices.id),
    tenantId: text("tenant_id")
        .notNull()
        .references(() => tenants.id),
    userId: text("user_id").notNull(), // Clerk user ID
    content: text("content").notNull(),
    summary: text("summary"), // AI generated 1-sentence TL;DR of long content
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Notice Attachments (proof of filing / response docs) ─────────────────────
export const attachments = pgTable("attachments", {
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
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Audit Logs (Immutable, append-only) ──────────────────────────────────────
export const auditLogs = pgTable("audit_logs", {
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
    createdAt: timestamp("created_at").defaultNow().notNull(),
});
