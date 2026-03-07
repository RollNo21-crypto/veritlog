import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 5000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, { ...options, signal: controller.signal });
        return res;
    } finally {
        clearTimeout(timer);
    }
}

const CLERK_HEADERS = () => ({
    Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
});

export const membersRouter = createTRPCRouter({
    /**
     * List team members for assignment.
     * - If org is active in session → fetch that org's members
     * - If no org in session → look up user's org memberships and fetch first org members
     * - Fallback → return just the current user (solo mode)
     */
    list: protectedProcedure.query(async ({ ctx }) => {
        const userId = ctx.session.userId;
        // Prefer session orgId, fall back to looking up user's orgs
        let orgId = ctx.session.orgId;

        // If no org in session, try to find the user's org via Clerk API
        if (!orgId && userId) {
            try {
                const res = await fetchWithTimeout(
                    `https://api.clerk.com/v1/users/${userId}/organization_memberships?limit=5`,
                    { headers: CLERK_HEADERS() }
                );
                if (res.ok) {
                    const json = await res.json() as { data: { organization: { id: string } }[] };
                    orgId = json.data?.[0]?.organization?.id ?? undefined;
                }
            } catch (err) {
                console.warn("[members.list] Could not fetch user org memberships:", err);
            }
        }

        // Fetch org members
        if (orgId) {
            try {
                const res = await fetchWithTimeout(
                    `https://api.clerk.com/v1/organizations/${orgId}/memberships?limit=50`,
                    { headers: CLERK_HEADERS() }
                );

                if (res.ok) {
                    const json = await res.json() as {
                        data: {
                            public_user_data: {
                                user_id: string;
                                first_name: string | null;
                                last_name: string | null;
                                identifier: string;
                                image_url: string;
                            };
                        }[];
                    };

                    const members = (json.data ?? []).map(({ public_user_data: u }) => ({
                        id: u.user_id,
                        name: [u.first_name, u.last_name].filter(Boolean).join(" ") || "Unknown",
                        email: u.identifier,
                        imageUrl: u.image_url,
                    })).filter(m => m.id); // remove any blanks

                    if (members.length > 0) return members;
                } else {
                    console.warn("[members.list] Clerk org members API:", res.status);
                }
            } catch (err) {
                console.warn("[members.list] Clerk org members fetch failed:", err);
            }
        }

        // Solo fallback — at minimum return self
        return [{ id: userId, name: "Me", email: "", imageUrl: "" }];
    }),
});
