import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { tenants } from "~/server/db/schema";
import { eq } from "drizzle-orm";

export const tenantRouter = createTRPCRouter({
    /**
     * Fetch the current user's tenant (organization/personal) record.
     * Used by the Navbar to display the Pine Labs Compliance Score badge.
     */
    getMyTenant: protectedProcedure.query(async ({ ctx }) => {
        const tenantId = ctx.session.userId;
        if (!tenantId) return null;

        const result = await ctx.db
            .select()
            .from(tenants)
            .where(eq(tenants.id, tenantId))
            .limit(1);

        return result[0] ?? null;
    }),
});
