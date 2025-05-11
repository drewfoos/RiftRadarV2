// scripts/clear-db.ts
import 'dotenv/config'; // Load .env.local variables for database connection
import { db } from '../src/lib/db'; // Adjust path to your Drizzle client
import {
  playerCache,
  riotIdCache,
  playerMatchIds,
  matchDetails,
  // Add any other tables you want to clear here
} from '../src/lib/db/schema'; // Adjust path to your schema file

async function clearDatabase() {
  console.log('🗑️  Starting database cleanup...');

  try {
    // It's generally safer to delete from tables that are referenced by others first,
    // or ensure your foreign keys have ON DELETE CASCADE (though we haven't defined explicit FKs here yet).
    // For now, we'll delete from all known tables.

    console.log('Deleting from matchDetails...');
    await db.delete(matchDetails);

    console.log('Deleting from playerMatchIds...');
    await db.delete(playerMatchIds);

    console.log('Deleting from riotIdCache...');
    await db.delete(riotIdCache);

    console.log('Deleting from playerCache...');
    await db.delete(playerCache);

    // Add delete statements for any other tables you create, for example:
    // console.log('Deleting from appUsers...');
    // await db.delete(appUsers);

    console.log('✅ Database cleanup successful!');
  } catch (error) {
    console.error('❌ Error during database cleanup:', error);
    process.exit(1); // Exit with error code
  } finally {
    // If your Drizzle client setup involves a connection pool that needs explicit closing,
    // you might do it here. For @vercel/postgres, it manages connections automatically.
    // For a local 'pg' Pool, you might do: await pool.end();
    console.log('Database cleanup script finished.');
  }
}

clearDatabase();
