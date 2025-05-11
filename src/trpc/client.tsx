// src/trpc/client.tsx
'use client';
// ^-- Mark this as a Client Component boundary

import type { QueryClient as TanStackQueryClient } from '@tanstack/react-query';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTRPCClient, httpBatchLink, loggerLink } from '@trpc/client';
// The new context creator from the TanStack React Query integration for v11
import { createTRPCContext } from '@trpc/tanstack-react-query';
import { useState } from 'react';
import superjson from 'superjson'; // Ensure transformer consistency with the server

import { makeQueryClient } from './query-client'; // Your factory from src/trpc/query-client.ts
// Adjust path if your AppRouter is elsewhere, typically src/trpc/routers/_app.ts
import type { AppRouter } from './routers/_app';

/**
 * Create the tRPC context for the client.
 * This exports:
 * - TRPCProvider: A component to wrap your application, providing tRPC and React Query context.
 * - useTRPC: A hook to access the tRPC client instance within your components.
 */
export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>();

// Singleton QueryClient for the browser to avoid re-creating on React Suspense.
let browserQueryClient: TanStackQueryClient | undefined = undefined;

/**
 * Retrieves a QueryClient instance.
 * - On the server, it always creates a new instance.
 * - In the browser, it uses a singleton pattern to ensure the same instance is reused.
 * @returns {TanStackQueryClient} The QueryClient instance.
 */
function getQueryClient() {
  if (typeof window === 'undefined') {
    // Server: always create a new query client instance for each request.
    return makeQueryClient();
  }
  // Browser: use a singleton. Create a new client if one doesn't exist.
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}

/**
 * Helper function to determine the base URL for tRPC API requests.
 * Handles different environments (browser, Vercel deployment, local development).
 * @returns {string} The base URL for the tRPC API.
 */
function getBaseUrl() {
  if (typeof window !== 'undefined') {
    // In the browser, use a relative path so it works on any domain.
    return '';
  }
  // Check for Vercel deployment URLs (prefer NEXT_PUBLIC_VERCEL_URL if set by user).
  if (process.env.NEXT_PUBLIC_VERCEL_URL) {
    return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`;
  }
  if (process.env.VERCEL_URL) {
    // VERCEL_URL is automatically set by Vercel.
    return `https://${process.env.VERCEL_URL}`;
  }
  // Fallback for local development.
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

/**
 * The main TRPCReactProvider component.
 * This should wrap your root layout or relevant parts of your application
 * to provide tRPC and React Query capabilities to child components.
 *
 * @param props Contains the children components to wrap.
 */
export function TRPCReactProvider(props: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      // Transformer is NO LONGER a top-level property here
      // links is an array of link objects
      links: [
        loggerLink({
          enabled: (opts) =>
            process.env.NODE_ENV === 'development' ||
            (opts.direction === 'down' && opts.result instanceof Error),
          colorMode: 'ansi',
        }),
        httpBatchLink({
          url: `${getBaseUrl()}/api/trpc`,
          // The transformer property is MOVED HERE, inside the httpBatchLink options
          transformer: superjson,
          // You can add custom headers here if needed
          // async headers() {
          //   return {
          //     authorization: `Bearer ${getAuthToken()}`,
          //   };
          // },
        }),
      ],
    })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {props.children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}
