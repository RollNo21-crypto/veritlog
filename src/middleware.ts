import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher([
    "/dashboard(.*)",
]);

const isPublicRoute = createRouteMatcher([
    "/pay(.*)",
    "/api/pine-labs/webhook(.*)",
    "/api/pine-labs/create-order(.*)",
    "/api/pine-labs/verify(.*)",
    "/api/pine-labs/callback(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
    if (isPublicRoute(req)) {
        return; // Early return for public routes to avoid Clerk interference
    }
    if (isProtectedRoute(req)) {
        await auth.protect();
    }
});

export const config = {
    matcher: [
        // Skip Next.js internals, static files, and payment callbacks/webhooks
        "/((?!_next|api/pine-labs/callback|api/pine-labs/webhook|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
        // Always run for API routes EXCEPT pine labs webhooks and callbacks
        "/(api(?!/pine-labs/callback|/pine-labs/webhook)|trpc)(.*)",
    ],
};
