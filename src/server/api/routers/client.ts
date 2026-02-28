import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { clients } from "~/server/db/schema";
import { eq, and } from "drizzle-orm";

export const clientRouter = createTRPCRouter({
    /**
     * Create a new client profile (FR15)
     */
    create: protectedProcedure
        .input(
            z.object({
                businessName: z.string().min(1),
                gstin: z.string().optional(),
                pan: z.string().optional(),
                contactName: z.string().optional(),
                contactEmail: z.string().email().optional(),
                contactPhone: z.string().optional(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const tenantId = ctx.session.orgId || ctx.session.userId;
            if (!tenantId) {
                throw new Error("No organization or user selected");
            }

            const clientId = `client_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

            await ctx.db.insert(clients).values({
                id: clientId,
                tenantId,
                ...input,
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            return { id: clientId };
        }),

    /**
     * List all clients for current tenant
     */
    list: protectedProcedure.query(async ({ ctx }) => {
        const tenantId = ctx.session.orgId || ctx.session.userId;
        if (!tenantId) {
            return [];
        }

        return await ctx.db
            .select()
            .from(clients)
            .where(eq(clients.tenantId, tenantId))
            .orderBy(clients.businessName);
    }),

    /**
     * Get a single client by ID
     */
    getById: protectedProcedure
        .input(z.object({ id: z.string() }))
        .query(async ({ ctx, input }) => {
            const tenantId = ctx.session.orgId || ctx.session.userId;
            if (!tenantId) {
                throw new Error("No organization or user selected");
            }

            const result = await ctx.db
                .select()
                .from(clients)
                .where(and(eq(clients.id, input.id), eq(clients.tenantId, tenantId)))
                .limit(1);

            return result[0] ?? null;
        }),

    /**
     * Update client profile
     */
    update: protectedProcedure
        .input(
            z.object({
                id: z.string(),
                businessName: z.string().min(1).optional(),
                gstin: z.string().optional(),
                pan: z.string().optional(),
                contactName: z.string().optional(),
                contactEmail: z.string().email().optional(),
                contactPhone: z.string().optional(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const tenantId = ctx.session.orgId || ctx.session.userId;
            if (!tenantId) {
                throw new Error("No organization or user selected");
            }

            const { id, ...updates } = input;

            await ctx.db
                .update(clients)
                .set({ ...updates, updatedAt: new Date() })
                .where(and(eq(clients.id, id), eq(clients.tenantId, tenantId)));

            return { success: true };
        }),

    /**
     * Delete a client
     */
    delete: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ ctx, input }) => {
            const tenantId = ctx.session.orgId || ctx.session.userId;
            if (!tenantId) {
                throw new Error("No organization or user selected");
            }

            await ctx.db
                .delete(clients)
                .where(and(eq(clients.id, input.id), eq(clients.tenantId, tenantId)));

            return { success: true };
        }),
});
