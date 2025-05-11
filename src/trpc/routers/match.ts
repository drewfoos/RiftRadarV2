import { matchDetails } from '@/lib/db/schema';
import { TRPCError } from '@trpc/server';
import 'dotenv/config';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { publicProcedure, router } from '../init';
// Import Spectator V5 types
import type { CurrentGameInfo } from '@/types/spectatorV5'; // Adjust path if needed

// Cache durations
const CACHE_DURATION_MATCH_DETAILS_REDIS_SECONDS = 60 * 60;  // 1 hour
const CACHE_DURATION_MATCH_DETAILS_DB_MILLISECONDS = 7 * 24 * 60 * 60 * 1000; // 7 days
const CACHE_DURATION_CURRENT_GAME_REDIS_SECONDS = 1 * 60; // 1 minute for live game data
const CACHE_DURATION_CURRENT_GAME_NULL_REDIS_SECONDS = 30; // 30 seconds for caching "not in game"

const DEFAULT_MATCH_COUNT = 10;

// Helper function to map platform ID to MATCH-V5 regional route
function getMatchV5ApiRegion(platformId: string): string {
  const lowerId = platformId.toLowerCase();
  if (['na1', 'br1', 'la1', 'la2'].includes(lowerId)) return 'americas';
  if (['eun1', 'euw1', 'tr1', 'ru', 'oc1'].includes(lowerId)) return 'europe'; 
  if (['kr', 'jp1'].includes(lowerId)) return 'asia';
  if (['ph2', 'sg2', 'th2', 'tw2', 'vn2'].includes(lowerId)) return 'sea';
  console.warn(`Unsupported platformId '${platformId}' for Match-V5 regional routing in matchRouter. Defaulting to 'americas'.`);
  return 'americas'; 
}

export const matchRouter = router({
  getMatchIdsByPuuid: publicProcedure
    .input(
      z.object({
        puuid: z.string().min(20),
        platformId: z.string().min(2),
        limit: z.number().min(1).max(100).optional().default(DEFAULT_MATCH_COUNT),
        cursor: z.number().nullish(), 
        startTime: z.number().int().optional(),
        endTime: z.number().int().optional(),
        queue: z.number().int().optional(),
        type: z.enum(['ranked', 'normal', 'tourney', 'tutorial']).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { puuid, platformId, limit, cursor, startTime, endTime, queue, type } = input;
      const { riotApi } = ctx; 
      const start = cursor || 0;
      // console.log(`[API CALL - Match IDs] PUUID: ${puuid}, Platform: ${platformId}, Start: ${start}, Count: ${limit}`);
      try {
        const matchIdsFromApi = await riotApi.getMatchIdsByPuuid(puuid, platformId, {
          start,
          count: limit,
          startTime, 
          endTime,
          queue,
          type,
        });
        let nextCursor: typeof cursor | undefined = undefined;
        if (matchIdsFromApi.length === limit) {
          nextCursor = start + limit;
        }
        return {
          items: matchIdsFromApi,
          nextCursor,
        };
      } catch (error: any) {
        console.error(`Error fetching Match IDs via riotApi service for PUUID ${puuid} (start: ${start}, count: ${limit}):`, error.message);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Failed to fetch match IDs: ${error.message}` });
      }
    }),

  getMatchDetails: publicProcedure
    .input(
      z.object({
        matchId: z.string().min(5),
        platformId: z.string().min(2),
      })
    )
    .query(async ({ ctx, input }) => {
      const { matchId, platformId } = input;
      const { db, redis, riotApi } = ctx;
      const matchApiRegion = getMatchV5ApiRegion(platformId);
      const redisKey = `match:details:${matchApiRegion}:${matchId}`;

      if (redis) {
        try {
          const cachedValue: string | null | object = await redis.get(redisKey); 
          if (cachedValue) {
            // console.log(`[CACHE HIT - Redis] Match Details for MatchID: ${matchId}`);
            if (typeof cachedValue === 'string') {
                return { ...(JSON.parse(cachedValue) as any), fetchedFrom: 'Redis Cache (Parsed String)' };
            }
            // If it's already an object (due to Redis client auto-parsing)
            return { ...(cachedValue as any), fetchedFrom: 'Redis Cache (Object)' };
          }
        } catch (err: any) {
          console.error(`Redis GET/PARSE error for match details (${redisKey}):`, err.message);
        }
      }

      try {
        const dbResult = await db.select()
          .from(matchDetails)
          .where(and(eq(matchDetails.matchId, matchId), eq(matchDetails.matchApiRegion, matchApiRegion)))
          .limit(1);

        if (dbResult.length > 0) {
          const record = dbResult[0];
          if ((Date.now() - record.lastFetched) < CACHE_DURATION_MATCH_DETAILS_DB_MILLISECONDS) {
            // console.log(`[CACHE HIT - DB] Match Details for MatchID: ${matchId}`);
            const matchDataFromDb = record.data as any; 
            if (redis) {
              redis.set(redisKey, JSON.stringify(matchDataFromDb), { ex: CACHE_DURATION_MATCH_DETAILS_REDIS_SECONDS }) // Always store as string
                .catch((setErr: any) => console.error(`Redis SET error (DB hit) for match details ${redisKey}:`, setErr.message));
            }
            return { ...matchDataFromDb, fetchedFrom: 'Database Cache' };
          }
          // console.log(`[CACHE STALE - DB] Match Details for MatchID: ${matchId}`);
        }
      } catch (err: any) { console.error(`DB SELECT error for MatchID ${matchId}:`, err.message); }

      // console.log(`[API CALL - Match Details] Fetching via riotApi service for MatchID: ${matchId}`);
      try {
        const detailsFromApi = await riotApi.getMatchDetails(matchId, platformId); 
        const dataToCache = detailsFromApi; 

        await db.insert(matchDetails)
          .values({ matchId, matchApiRegion, data: dataToCache, lastFetched: Date.now() })
          .onConflictDoUpdate({ target: matchDetails.matchId, set: { data: dataToCache, lastFetched: Date.now(), matchApiRegion } })
          .catch((dbErr: any) => console.error(`DB INSERT/UPDATE error for MatchID ${matchId}:`, dbErr.message));

        if (redis) {
          await redis.set(redisKey, JSON.stringify(dataToCache), { ex: CACHE_DURATION_MATCH_DETAILS_REDIS_SECONDS }) // Always store as string
            .catch((setErr: any) => console.error(`Redis SET error (API fetch) for match details ${redisKey}:`, setErr.message));
        }
        return dataToCache; 
      } catch (error: any) {
        console.error(`Error fetching Match Details via riotApi service or caching for MatchID ${matchId}:`, error.message);
        try {
            const dbResultStale = await db.select().from(matchDetails)
              .where(and(eq(matchDetails.matchId, matchId), eq(matchDetails.matchApiRegion, matchApiRegion))).limit(1);
            if (dbResultStale.length > 0 && dbResultStale[0].data) {
              console.warn(`[API ERROR FALLBACK] Serving stale DB data for MatchID ${matchId}`);
              return { ...(dbResultStale[0].data as any), fetchedFrom: 'Database Cache (Stale - API Error)' };
            }
        } catch (dbError: any) { console.error(`DB fallback error for MatchID ${matchId} after API error:`, dbError.message); }
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Failed to fetch match details: ${error.message}` });
      }
    }),

  // --- Updated Spectator V5 Procedure ---
  getCurrentGameInfo: publicProcedure
    .input(
      z.object({
        puuid: z.string().min(20),
        platformId: z.string().min(2),
      })
    )
    .query(async ({ ctx, input }): Promise<CurrentGameInfo | null> => {
      const { puuid, platformId } = input;
      const { redis, riotApi } = ctx;
      const normalizedPlatformId = platformId.toLowerCase();
      const redisKey = `spectator:currentgame:${normalizedPlatformId}:${puuid}`;

      if (redis) {
        try {
          const cachedValue: string | null | object = await redis.get(redisKey); // Expect string or object (if auto-parsed by client)

          if (cachedValue !== null && cachedValue !== undefined) {
            if (typeof cachedValue === 'string') {
              if (cachedValue === 'null') { 
                console.log(`[CACHE HIT - Redis - Player Not In Game (String "null")] Current Game Info for PUUID: ${puuid}`);
                return null; 
              }
              try {
                const parsedData = JSON.parse(cachedValue) as CurrentGameInfo;
                console.log(`[CACHE HIT - Redis - Parsed String] Current Game Info for PUUID: ${puuid}`);
                return parsedData; 
              } catch (parseError) {
                console.error(`Redis JSON parse error for string data (${redisKey}):`, parseError, "Raw string data:", cachedValue);
                // Fall through to API call
              }
            } else if (typeof cachedValue === 'object') {
              // Check if it's the specific "null object" we might store if redis client doesn't support storing literal null well
              // This check depends on how you might store a "not in game" state if not as string "null"
              // For now, assume any object is valid CurrentGameInfo if not string "null"
              console.log(`[CACHE HIT - Redis - Object from Cache] Current Game Info for PUUID: ${puuid}`);
              return cachedValue as CurrentGameInfo; 
            }
          }
        } catch (err: any) {
          console.error(`Redis GET error for current game info (${redisKey}):`, err.message);
        }
      }
      
      console.log(`[API CALL - Current Game Info] Fetching via riotApi service for PUUID: ${puuid}`);
      try {
        const liveGameData = await riotApi.getCurrentGameInfoByPuuid(puuid, normalizedPlatformId);
        
        if (redis) {
          if (liveGameData) { 
            await redis.set(redisKey, JSON.stringify(liveGameData), { ex: CACHE_DURATION_CURRENT_GAME_REDIS_SECONDS })
              .catch((setErr: any) => console.error(`Redis SET error (API fetch) for current game info ${redisKey}:`, setErr.message));
          } else {
            await redis.set(redisKey, 'null', { ex: CACHE_DURATION_CURRENT_GAME_NULL_REDIS_SECONDS }) 
              .catch((setErr: any) => console.error(`Redis SET error (API fetch - null game) for current game info ${redisKey}:`, setErr.message));
          }
        }
        return liveGameData;
      } catch (error: any) {
        console.error(`Error fetching Current Game Info via riotApi service for PUUID ${puuid}:`, error.message);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Failed to process current game info request: ${error.message}` });
      }
    }),
});
