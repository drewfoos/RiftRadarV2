// drizzle.config.ts
import dotenv from 'dotenv';
import { defineConfig } from 'drizzle-kit';

dotenv.config({ path: '.env.local' }); // Explicitly load .env.local

if (!process.env.POSTGRES_URL) {
  throw new Error(
    'POSTGRES_URL environment variable is not set or not loaded correctly from .env.local!'
  );
}

export default defineConfig({
  schema: './src/lib/db/schema.ts', // Path to your schema
  out: './drizzle',                  // For migrations (not directly used by push)
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.POSTGRES_URL,
  },
});