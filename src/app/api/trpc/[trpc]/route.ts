// app/api/trpc/[trpc]/route.ts
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
// Assuming your AppRouter is in src/trpc/routers/_app.ts and @/ maps to src/
import { appRouter } from '@/trpc/routers/_app';
// Assuming your context creation is in src/trpc/init.ts and @/ maps to src/
import { createTRPCContext } from '@/trpc/init';

/**
 * Handles incoming tRPC requests.
 * This function uses `fetchRequestHandler` from tRPC to adapt your `appRouter`
 * to the Next.js App Router's request/response model.
 */
const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc', // The base endpoint for your tRPC API
    req,                   // The incoming Next.js request object
    router: appRouter,     // Your main tRPC application router
    
    /**
     * Creates the context for each tRPC request.
     * This function is called for every request and should provide
     * any necessary data or utilities (like database connections, session info)
     * to your tRPC procedures.
     * `opts` here will be of type `FetchCreateContextFnOptions`.
     */
    createContext: (opts) => createTRPCContext(opts),
    
    /**
     * Optional error handler for logging errors in development.
     * In production, you might want more sophisticated error reporting.
     */
    onError:
      process.env.NODE_ENV === 'development'
        ? ({ path, error }) => {
            console.error(
              `❌ tRPC failed on ${path ?? '<no-path>'}: ${error.message}`,
              // For more detailed error logging in development, you can uncomment the line below:
              // error, 
            );
          }
        : undefined,
  });

// Export the handler for both GET and POST requests, as tRPC uses both.
export { handler as GET, handler as POST };
