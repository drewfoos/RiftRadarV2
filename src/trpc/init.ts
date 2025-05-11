// src/trpc/init.ts
import { db } from '@/lib/db'; // Your Drizzle ORM client (connects to Neon)
import { redis } from '@/lib/redis'; // Your Upstash Redis client
import { initTRPC } from '@trpc/server';
import type { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch';
import superjson from 'superjson'; // For rich data types over JSON
// Import only the riotApiService instance. The type will be inferred.
import { riotApiService } from '@/lib/riotApiService';
import 'dotenv/config'; // Ensure environment variables are available

/**
 * 1. CONTEXT
 *
 * Defines the data and services accessible to your tRPC procedures.
 */

// Options for creating context, potentially including request headers.
interface CreateContextOptions {
  headers?: Headers;
  // Add other context properties you might pass from non-HTTP callers if necessary
}

/**
 * Creates the tRPC context for each request.
 * This function is called by the tRPC HTTP adapter (for client requests)
 * and by server-side callers (for RSCs or internal calls).
 *
 * @param opts - For HTTP requests, this will be FetchCreateContextFnOptions.
 * For server-side calls, it might be simpler or undefined.
 * @returns The context object available to tRPC procedures.
 */
export const createTRPCContext = async (
  opts?: FetchCreateContextFnOptions | CreateContextOptions,
) => {
  const headers = opts && 'req' in opts ? opts.req.headers : opts?.headers;

  // The context now includes your database, redis, the riotApi service, and headers.
  return {
    db,
    redis,
    riotApi: riotApiService, // Provide the Riot API service instance via context
    headers,
    // session: await getSession(), // Example placeholder for authentication
  };
};

// Infer the context type to be used in procedures and middleware
export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;

/**
 * 2. INITIALIZATION
 *
 * Initializes the tRPC backend with the defined context and data transformer.
 * Includes an error formatter for consistent error shapes, especially for Zod validation errors.
 */
const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson, // Recommended for handling complex data types
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        // If the error is due to Zod validation, include its flattened issues
        zodError:
          error.cause instanceof Error && error.cause.name === 'ZodError'
            ? (error.cause as any).flatten() // Cast to any if flatten() isn't typed on Error
            : null,
      },
    };
  },
});

/**
 * 3. ROUTER & PROCEDURE HELPERS
 *
 * Core building blocks for your tRPC API.
 */

/**
 * Reusable router creation helper.
 * @see https://trpc.io/docs/router
 */
export const router = t.router;

/**
 * Public (unauthenticated) procedure helper.
 * Use this to build new queries and mutations.
 * @see https://trpc.io/docs/procedures
 */
export const publicProcedure = t.procedure;

/**
 * Server-side caller factory.
 * Allows calling tRPC procedures directly from server-side code (e.g., RSCs)
 * without an HTTP request.
 * @see https://trpc.io/docs/server/server-side-calls
 */
export const createCallerFactory = t.createCallerFactory;
