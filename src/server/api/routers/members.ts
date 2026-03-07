import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

type ClerkMember = {
    id: string;
    firstName: string | null;
    lastName: string | null;
    emailAddresses: { emailAddress: string }[];
    imageUrl: string;
};

export const membersRouter = createTRPCRouter({
    /**
     * List all staff/members in the current Clerk organization or tenant.
     * Falls back to just the current user in a solo (non-org) context.
     */
    list: protectedProcedure.query(async ({ ctx }) => {
        const orgId = ctx.session.userId;

        if (orgId) {
            // Fetch org members via Clerk Backend API
            const res = await fetch(
                `https://api.clerk.com/v1/organizations/${orgId}/memberships?limit=50`,
                {
                    headers: {
                        Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
                    },
                }
            );

            if (!res.ok) {
                console.warn("[members.list] Clerk org membership fetch failed:", res.status);
                return [];
            }

            const { data } = await res.json() as { data: { public_user_data: ClerkMember }[] };

            return (data ?? []).map(({ public_user_data: u }) => ({
                id: u.id,
                name: [u.firstName, u.lastName].filter(Boolean).join(" ") || "Unknown",
                email: u.emailAddresses[0]?.emailAddress ?? "",
                imageUrl: u.imageUrl,
            }));
        }

        // Solo mode — return just the current user from their session
        const userId = ctx.session.userId;
        return [
            {
                id: userId,
                name: "You",
                email: "",
                imageUrl: "",
            },
        ];
    }),
});
