// src/trpc/server.tsx
import 'server-only'; // Ensures this module is only used on the server-side

// The new proxy creator from the TanStack React Query integration for tRPC v11
import { dehydrate, HydrationBoundary } from '@tanstack/react-query'; // For manual hydration if needed
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query';
import { cache } from 'react'; // React's cache for creating stable, request-scoped instances

// Context creator from your init file (e.g., src/trpc/init.ts)
import { createCallerFactory, createTRPCContext } from './init';
// QueryClient factory from your query-client file (e.g., src/trpc/query-client.ts)
import { makeQueryClient } from './query-client';
// Your main AppRouter and its type definition (e.g., from src/trpc/routers/_app.ts)
import { appRouter, type AppRouter } from './routers/_app';

/**
 * Creates a stable, request-scoped QueryClient instance.
 * Using React's `cache` function is crucial here. It ensures that during a single
 * server request lifecycle, `makeQueryClient()` is only called once, and the same
 * QueryClient instance is reused. This prevents data inconsistencies and unnecessary
 * re-creations of the QueryClient.
 */
export const getQueryClientCached = cache(makeQueryClient);

/**
 * Creates a tRPC proxy client specifically for usage in React Server Components (RSCs).
 * This proxy (`rscTRPC`) provides methods like `.queryOptions()` for each of your tRPC procedures.
 * These `queryOptions` can then be passed to TanStack Query functions like `queryClient.prefetchQuery()`
 * or `useQuery()` (in client components after hydration).
 */
export const rscTRPC = createTRPCOptionsProxy<AppRouter>({
  /**
   * The context function to be used for server-side tRPC calls initiated via this proxy.
   * It should provide the necessary context (like your Drizzle `db` and Upstash `redis` clients)
   * for your tRPC procedures.
   * Ensure `createTRPCContext` (from ./init.ts) can handle being called without
   * specific HTTP request options if this proxy is used in non-HTTP scenarios,
   * though for RSC prefetching, it's typically part of a server-side render pass.
   *
   * CORRECTED PROPERTY NAME: 'ctx' instead of 'context'
   */
  ctx: async () => createTRPCContext({ /* Pass headers or other specific opts if needed */ }),
  // Your main tRPC application router.
  router: appRouter,
  // The stable, request-scoped QueryClient getter function.
  queryClient: getQueryClientCached,
});

// --- Optional but Recommended Helper Components and Functions from tRPC Docs ---

/**
 * A reusable React component that handles dehydrating the QueryClient state
 * from the server and setting up the <HydrationBoundary> for client components.
 * This makes it easier to pass server-prefetched data to the client for hydration.
 *
 * @param props Contains the children components to wrap within the hydration boundary.
 */
export function HydrateClient(props: { children: React.ReactNode }) {
  // Get the stable QueryClient instance for the current server request
  const queryClient = getQueryClientCached();
  // Dehydrate the current state of the queryClient
  const dehydratedState = dehydrate(queryClient);

  // Render the HydrationBoundary, passing the dehydrated state as props.
  // Client components under this boundary can then use TanStack Query hooks
  // and will pick up the prefetched/hydrated data.
  return (
    <HydrationBoundary state={dehydratedState}>
      {props.children}
    </HydrationBoundary>
  );
}

/**
 * A helper function to simplify prefetching queries in Server Components.
 * It takes the query options object, typically generated via `rscTRPC.path.to.procedure.queryOptions(input)`.
 *
 * Example Usage in a Server Component:
 * const queryOptions = rscTRPC.player.getProfileByPuuid.queryOptions({ puuid: '...' });
 * await prefetch(queryOptions);
 *
 * @param options The query options object, which must include `queryKey` and `queryFn`.
 */
export async function prefetch(options: {
  queryKey: unknown[];
  queryFn: () => Promise<unknown>;
  // Add other TanStack Query prefetch options if needed, e.g., for infinite queries
  // initialPageParam?: unknown;
  // getNextPageParam?: (...args: any[]) => unknown;
}) {
  const queryClient = getQueryClientCached();

  // Basic prefetch. For infinite queries, you'd use queryClient.prefetchInfiniteQuery
  // and might need to adjust the 'options' type or add a check.
  // e.g., if (options.queryKey[1]?.type === 'infinite' || options.initialPageParam !== undefined) {
  //   return queryClient.prefetchInfiniteQuery(options as any); // Cast might be needed for specific infinite options
  // }
  return queryClient.prefetchQuery(options);
}


/**
 * If you need to access data directly in a Server Component *without* the intention
 * of prefetching it for client-side hydration via the React Query cache (e.g., for
 * server-only logic, generating static parts of a page, or passing data as simple props),
 * you can create and use a "direct server caller."
 * This caller is detached from the React Query client cache used for hydration.
 */
// Create the caller factory using your main appRouter (from init.ts)
const _directServerCallerFactory = createCallerFactory(appRouter);

// Create an instance of the direct server caller
export const directServerCaller = _directServerCallerFactory(
  /**
   * Provide the context for these direct server calls.
   * This context should include dependencies like `db` and `redis`.
   */
  async () => createTRPCContext({ /* Pass any necessary opts for server context */ })
);
