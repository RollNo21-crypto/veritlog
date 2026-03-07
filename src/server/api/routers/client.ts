import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { clients, notices } from "~/server/db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";

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
            const tenantId = ctx.session.userId;
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
        const tenantId = ctx.session.userId;
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
            const tenantId = ctx.session.userId;
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
            const tenantId = ctx.session.userId;
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
            const tenantId = ctx.session.userId;
            if (!tenantId) {
                throw new Error("No organization or user selected");
            }

            await ctx.db
                .delete(clients)
                .where(and(eq(clients.id, input.id), eq(clients.tenantId, tenantId)));

            return { success: true };
        }),

    /**
     * Send a portal invitation to the client's contact email (FR16 — Story 4.2)
     * Uses Clerk's invitation API to send a magic-link email.
     */
    sendPortalInvite: protectedProcedure
        .input(z.object({ clientId: z.string() }))
        .mutation(async ({ ctx, input }) => {
            const tenantId = ctx.session.userId;
            if (!tenantId) throw new Error("No organization or user selected");

            const [client] = await ctx.db
                .select({ contactEmail: clients.contactEmail, businessName: clients.businessName })
                .from(clients)
                .where(and(eq(clients.id, input.clientId), eq(clients.tenantId, tenantId)));

            if (!client) throw new Error("Client not found");
            if (!client.contactEmail) throw new Error("Client has no contact email");

            // Use Clerk's Organization Invitation API to send the magic link
            const res = await fetch(
                `https://api.clerk.com/v1/organizations/${tenantId}/invitations`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        email_address: client.contactEmail,
                        role: "org:client_viewer",
                        public_metadata: {
                            clientId: input.clientId,
                            tenantId,
                            role: "client_viewer",
                        },
                        redirect_url: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/portal`,
                    }),
                }
            );

            if (!res.ok) {
                const body = await res.json() as { errors?: { message: string }[] };
                const msg = body.errors?.[0]?.message ?? "Failed to send invite";
                // Gracefully handle "already invited" scenario
                if (msg.toLowerCase().includes("already")) {
                    return { success: true, alreadyInvited: true };
                }
                throw new Error(msg);
            }

            return { success: true, alreadyInvited: false };
        }),

    /**
     * List notices for a specific client — used on the client portal (FR17 — Story 4.3)
     */
    listNoticesForClient: protectedProcedure
        .input(z.object({ clientId: z.string() }))
        .query(async ({ ctx, input }) => {
            const tenantId = ctx.session.userId;
            if (!tenantId) return [];

            return ctx.db
                .select({
                    id: notices.id,
                    fileName: notices.fileName,
                    authority: notices.authority,
                    noticeType: notices.noticeType,
                    amount: notices.amount,
                    deadline: notices.deadline,
                    status: notices.status,
                    riskLevel: notices.riskLevel,
                    fileUrl: notices.fileUrl,
                    createdAt: notices.createdAt,
                })
                .from(notices)
                .where(
                    and(
                        eq(notices.tenantId, tenantId),
                        eq(notices.clientId, input.clientId),
                        isNull(notices.deletedAt)
                    )
                )
                .orderBy(desc(notices.createdAt));
        }),
});

