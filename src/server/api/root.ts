import { postRouter } from "~/server/api/routers/post";
import { noticeRouter } from "~/server/api/routers/notice";
import { clientRouter } from "~/server/api/routers/client";
import { commentRouter } from "~/server/api/routers/comment";
import { auditRouter } from "~/server/api/routers/audit";
import { statsRouter } from "~/server/api/routers/stats";
import { membersRouter } from "~/server/api/routers/members";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  post: postRouter,
  notice: noticeRouter,
  clients: clientRouter,
  comment: commentRouter,
  audit: auditRouter,
  stats: statsRouter,
  members: membersRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
