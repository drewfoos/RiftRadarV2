// src/lib/redis.ts
import { Redis } from '@upstash/redis';
import 'server-only'; // Ensures this module is only used on the server-side

// This check is important. If the environment variables are missing,
// the Redis client won't be initialized correctly.
if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  console.warn(
    "UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN environment variables are not set. " +
    "Redis client will not be initialized, and caching via Redis will be disabled."
  );
}

// Initialize the Redis client using environment variables.
// Redis.fromEnv() automatically picks up UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.
// If the variables are not set, assign null to redis so that parts of your app
// that conditionally use it can check for its existence.
export const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? Redis.fromEnv()
    : null;

// You can also be more explicit if you prefer, though fromEnv() is convenient:
// export const redis = new Redis({
//   url: process.env.UPSTASH_REDIS_REST_URL!, // The '!' asserts these are defined; handle appropriately if they might not be.
//   token: process.env.UPSTASH_REDIS_REST_TOKEN!,
// });
