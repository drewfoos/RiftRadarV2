// src/lib/db/index.ts
import { sql } from '@vercel/postgres'; // This is the Vercel Postgres SDK client
import 'dotenv/config'; // To ensure .env.local is loaded, especially for scripts
import { drizzle } from 'drizzle-orm/vercel-postgres';
import * as schema from './schema'; // Assuming your schema.ts is in the same directory

// The `sql` object from @vercel/postgres will use the POSTGRES_URL from your environment.
export const db = drizzle(sql, { schema });