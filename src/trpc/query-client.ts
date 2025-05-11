    // src/trpc/query-client.ts
    import {
  defaultShouldDehydrateQuery,
  QueryClient,
} from '@tanstack/react-query';
import superjson from 'superjson'; // Ensure this is installed: bun add superjson

    export function makeQueryClient() {
      return new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000, // 30 seconds
            refetchOnWindowFocus: false,
          },
          dehydrate: {
            // UNCOMMENTED: Use superjson for serializing data during dehydration
            serializeData: superjson.serialize,
            shouldDehydrateQuery: (query) =>
              defaultShouldDehydrateQuery(query) ||
              query.state.status === 'pending',
          },
          hydrate: {
            // UNCOMMENTED: Use superjson for deserializing data during hydration
            deserializeData: superjson.deserialize,
          },
        },
      });
    }
    