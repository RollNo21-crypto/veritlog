import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const tenants = sqliteTable("tenants", {
    id: text("id").primaryKey(), // Clerk Org ID
    name: text("name").notNull(),
    plan: text("plan").notNull().default("free"),
    createdAt: integer("created_at", { mode: "timestamp" })
        .default(sql`(unixepoch())`)
        .notNull(),
});

export const notices = sqliteTable("notices", {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
        .notNull()
        .references(() => tenants.id),
    // More fields to be added in Epic 1
    createdAt: integer("created_at", { mode: "timestamp" })
        .default(sql`(unixepoch())`)
        .notNull(),
});
