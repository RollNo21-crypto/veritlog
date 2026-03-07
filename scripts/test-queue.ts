import { createCaller } from "../src/server/api/root";
import { db } from "../src/server/db";
import { notices } from "../src/server/db/schema";
import { eq } from "drizzle-orm";

const mockSession: any = {
    userId: "test-user-id",
    orgId: "test-org-id",
    expires: new Date().toISOString(),
};

async function testSorting() {
    const caller = createCaller({ db, session: mockSession, headers: new Headers() } as any);
    const tenantId = "test-org-id";

    // 1. Insert mock data
    console.log("Inserting mock records...");
    await db.insert(notices).values([
        {
            id: "notice-high-urgent",
            tenantId,
            fileName: "High Urgent Notice.pdf",
            fileUrl: "http://example.com/1",
            fileSize: 100,
            status: "review_needed",
            riskLevel: "high",
            deadline: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
            source: "upload",
            createdAt: new Date(),
            updatedAt: new Date(),
        },
        {
            id: "notice-high-later",
            tenantId,
            fileName: "High Later Notice.pdf",
            fileUrl: "http://example.com/2",
            fileSize: 100,
            status: "review_needed",
            riskLevel: "high",
            deadline: new Date(Date.now() + 86400000 * 5).toISOString(), // 5 days
            source: "upload",
            createdAt: new Date(),
            updatedAt: new Date(),
        },
        {
            id: "notice-low",
            tenantId,
            fileName: "Low Notice.pdf",
            fileUrl: "http://example.com/3",
            fileSize: 100,
            status: "review_needed",
            riskLevel: "low",
            deadline: new Date(Date.now() + 86400000 * 10).toISOString(), // 10 days
            source: "upload",
            createdAt: new Date(),
            updatedAt: new Date(),
        },
    ]);

    // 2. Query TRPC list with sorting
    console.log("Querying with sortBy = riskLevel...");
    const results = await caller.notice.list({ sortBy: "riskLevel", status: "review_needed" });

    console.log("Results Order:");
    results.forEach((r, i) => console.log(`${i + 1}. ${r.fileName} (Risk: ${r.riskLevel}, Deadline: ${r.deadline || 'None'})`));

    // Cleanup
    console.log("Cleaning up mock records...");
    await db.delete(notices).where(eq(notices.tenantId, tenantId));
    console.log("Done.");
}

testSorting().catch(console.error);
