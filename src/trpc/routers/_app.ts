// src/trpc/routers/_app.ts
import { z } from 'zod';
import { publicProcedure, router } from '../init'; // From your src/trpc/init.ts
import { matchRouter } from './match'; // Your new match router
import { playerRouter } from './players'; // Your player router

/**
 * This is the primary router for your tRPC API.
 * All routers added in /src/trpc/routers should be manually added here.
 */
export const appRouter = router({
  // Namespacing your routers:
  // Procedures from playerRouter will be accessible under `trpc.player.*`
  player: playerRouter,

  // Procedures from matchRouter will be accessible under `trpc.match.*`
  match: matchRouter,

  // A simple "hello world" procedure for basic testing and demonstration
  hello: publicProcedure
    .input(
      z.object({
        text: z.string().optional(),
      }).optional(), // Input can be an object with an optional 'text' field, or the input can be omitted entirely
    )
    .query(({ input, ctx }) => {
      // You can access context (db, redis) here if needed:
      // console.log('Context in hello router:', ctx.db, ctx.redis);

      return {
        greeting: `Hello ${input?.text ?? 'world from RiftRadar tRPC'}`,
      };
    }),

  // You can add other top-level routers here if needed in the future:
  // example: exampleRouter,
});

// Export type signature of your AppRouter only.
// This is used on the client side to provide type safety and auto-completion.
// NEVER expose a router instance (the `appRouter` const) to the client.
export type AppRouter = typeof appRouter;
