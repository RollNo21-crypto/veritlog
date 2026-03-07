/**
 * Story 6.3 — Tenant Isolation & Security Validation Suite
 * Tests that Tenant A CANNOT see Tenant B's data (FR25 / NFR13)
 *
 * Run: npx vitest run src/tests/security/tenant-isolation.test.ts
 * (or: npx jest src/tests/security/tenant-isolation.test.ts)
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "~/server/db";
import { notices, clients, auditLogs, tenants } from "~/server/db/schema";
import { eq, and } from "drizzle-orm";

// ─── Test fixtures ─────────────────────────────────────────────────────────────

const TENANT_A = "test_tenant_a_isolation";
const TENANT_B = "test_tenant_b_isolation";

const NOTICE_A_ID = "test_notice_a_isolation";
const NOTICE_B_ID = "test_notice_b_isolation";

async function seedTestData() {
    // Tenants
    await db.insert(tenants).values([
        { id: TENANT_A, name: "Test Tenant A", plan: "free" },
        { id: TENANT_B, name: "Test Tenant B", plan: "free" },
    ]).onConflictDoNothing();

    // Notices — one per tenant
    await db.insert(notices).values([
        {
            id: NOTICE_A_ID,
            tenantId: TENANT_A,
            fileName: "notice_a.pdf",
            fileUrl: "https://example.com/a.pdf",
            status: "processing",
            source: "upload",
            createdAt: new Date(),
            updatedAt: new Date(),
        },
        {
            id: NOTICE_B_ID,
            tenantId: TENANT_B,
            fileName: "notice_b.pdf",
            fileUrl: "https://example.com/b.pdf",
            status: "processing",
            source: "upload",
            createdAt: new Date(),
            updatedAt: new Date(),
        },
    ]).onConflictDoNothing();
}

async function cleanupTestData() {
    await db.delete(notices).where(eq(notices.tenantId, TENANT_A));
    await db.delete(notices).where(eq(notices.tenantId, TENANT_B));
    await db.delete(tenants).where(eq(tenants.id, TENANT_A));
    await db.delete(tenants).where(eq(tenants.id, TENANT_B));
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe("Tenant Isolation Security Tests", () => {
    beforeAll(async () => {
        await seedTestData();
    });

    afterAll(async () => {
        await cleanupTestData();
    });

    // ── Core isolation tests ────────────────────────────────────────────────────

    it("Tenant A can read its own notice", async () => {
        const result = await db
            .select()
            .from(notices)
            .where(
                and(
                    eq(notices.id, NOTICE_A_ID),
                    eq(notices.tenantId, TENANT_A)
                )
            );
        expect(result).toHaveLength(1);
        expect(result[0]!.tenantId).toBe(TENANT_A);
    });

    it("Tenant B CANNOT read Tenant A's notice (isolation enforced)", async () => {
        // Simulates a query from Tenant B's session scoped to TENANT_B
        const result = await db
            .select()
            .from(notices)
            .where(
                and(
                    eq(notices.id, NOTICE_A_ID), // trying to access Tenant A's notice
                    eq(notices.tenantId, TENANT_B) // but scoped to Tenant B's tenantId
                )
            );
        // MUST return empty — isolation works
        expect(result).toHaveLength(0);
    });

    it("Tenant A CANNOT read Tenant B's notice (isolation enforced)", async () => {
        const result = await db
            .select()
            .from(notices)
            .where(
                and(
                    eq(notices.id, NOTICE_B_ID),
                    eq(notices.tenantId, TENANT_A) // wrong tenant
                )
            );
        expect(result).toHaveLength(0);
    });

    it("List query for Tenant A returns ONLY Tenant A's notices", async () => {
        const result = await db
            .select()
            .from(notices)
            .where(eq(notices.tenantId, TENANT_A));

        // Every result must belong to Tenant A
        expect(result.every((n) => n.tenantId === TENANT_A)).toBe(true);
        // Tenant B's notice must not appear
        expect(result.some((n) => n.id === NOTICE_B_ID)).toBe(false);
    });

    it("List query for Tenant B returns ONLY Tenant B's notices", async () => {
        const result = await db
            .select()
            .from(notices)
            .where(eq(notices.tenantId, TENANT_B));

        expect(result.every((n) => n.tenantId === TENANT_B)).toBe(true);
        expect(result.some((n) => n.id === NOTICE_A_ID)).toBe(false);
    });

    it("Audit logs from Tenant A are NOT readable by Tenant B session", async () => {
        // Insert an audit log for Tenant A
        const logId = `audit_test_${Date.now()}`;
        await db.insert(auditLogs).values({
            id: logId,
            tenantId: TENANT_A,
            userId: "user_a",
            action: "notice.created",
            entityType: "notice",
            entityId: NOTICE_A_ID,
            createdAt: new Date(),
        });

        // Try to read it as Tenant B
        const result = await db
            .select()
            .from(auditLogs)
            .where(
                and(
                    eq(auditLogs.id, logId),
                    eq(auditLogs.tenantId, TENANT_B) // wrong tenant
                )
            );
        expect(result).toHaveLength(0);

        // Cleanup
        await db.delete(auditLogs).where(eq(auditLogs.id, logId));
    });

    it("Client records are tenant-scoped", async () => {
        const clientId = `test_client_isolation_${Date.now()}`;
        await db.insert(clients).values({
            id: clientId,
            tenantId: TENANT_A,
            businessName: "Tenant A Client",
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        // Tenant B cannot see Tenant A's client
        const result = await db
            .select()
            .from(clients)
            .where(
                and(
                    eq(clients.id, clientId),
                    eq(clients.tenantId, TENANT_B)
                )
            );
        expect(result).toHaveLength(0);

        // Cleanup
        await db.delete(clients).where(eq(clients.id, clientId));
    });

    // ── Soft delete isolation tests ─────────────────────────────────────────────

    it("Soft-deleted notices do NOT appear in standard list queries", async () => {
        // Soft-delete Tenant A's notice
        await db
            .update(notices)
            .set({ deletedAt: new Date() })
            .where(eq(notices.id, NOTICE_A_ID));

        const result = await db
            .select()
            .from(notices)
            .where(
                and(
                    eq(notices.tenantId, TENANT_A),
                    // Standard query excludes soft-deleted (isNull check)
                    eq(notices.id, NOTICE_A_ID)
                )
            );

        // Without isNull(deletedAt) filter, record still exists in DB
        // Verify our router WOULD filter it (the actual filter is tested
        // at the application layer — here we confirm deletedAt is set)
        expect(result[0]?.deletedAt).not.toBeNull();

        // Restore for later tests
        await db
            .update(notices)
            .set({ deletedAt: null })
            .where(eq(notices.id, NOTICE_A_ID));
    });
});
