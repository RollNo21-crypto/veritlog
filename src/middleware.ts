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
        // Skip Next.js internals and all static files, unless found in search params
        "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
        // Always run for API routes
        "/(api|trpc)(.*)",
    ],
};
