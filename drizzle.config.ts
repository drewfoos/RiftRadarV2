// drizzle.config.ts
import dotenv from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// Load .env.local for local development.
// On Vercel, environment variables are injected directly by the platform.
dotenv.config({ path: '.env.local' });

let connectionString: string | undefined;

// VERCEL_ENV is automatically set by Vercel during builds and deployments
// (e.g., 'production', 'preview', or 'development' when using `vercel dev`).
if (process.env.VERCEL_ENV) {
  // When running on Vercel (e.g., during a build step that runs migrations),
  // prioritize the non-pooled URL for Drizzle Kit.
  connectionString = process.env.POSTGRES_URL_NON_POOLING;

  if (!connectionString) {
    // Fallback and warning if the non-pooled URL isn't found on Vercel.
    // This might happen if the Vercel Postgres integration isn't fully set up
    // or if the variable names change in the future.
    console.warn(
      "WARNING: Running on Vercel, but POSTGRES_URL_NON_POOLING is not set. " +
      "Falling back to POSTGRES_URL for Drizzle Kit. " +
      "This might not be suitable for schema migrations and could indicate an issue with Vercel environment variable setup."
    );
    connectionString = process.env.POSTGRES_URL; // Pooled URL, less ideal for kit
  }
} else {
  // For local development, use the POSTGRES_URL from your .env.local file.
  // This should point to your local development database or a specific Neon dev instance.
  // Ensure this local POSTGRES_URL is a direct (non-pooled) connection if possible for consistency with Drizzle Kit's needs.
  connectionString = process.env.POSTGRES_URL;
}

if (!connectionString) {
  throw new Error(
    'Database connection string could not be determined. ' +
    'Ensure POSTGRES_URL (for local development) or ' +
    'POSTGRES_URL_NON_POOLING (when on Vercel) is correctly configured.'
  );
}

export default defineConfig({
  schema: './src/lib/db/schema.ts', // Path to your Drizzle schema
  out: './drizzle',                  // Output directory for migrations (if using drizzle-kit generate)
  dialect: 'postgresql',
  dbCredentials: {
    url: connectionString,
  },
  // Optional: uncomment for more detailed Drizzle Kit output
  // verbose: true,
  // Optional: uncomment for stricter schema checks
  // strict: true,
});
