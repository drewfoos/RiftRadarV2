import { playerCache, riotIdCache } from '@/lib/db/schema';
import { z } from 'zod';
import { publicProcedure, router } from '../init';
// Import necessary Drizzle functions
import { TRPCError } from '@trpc/server';
import 'dotenv/config';
import { and, desc, eq, sql } from 'drizzle-orm';
// Import types needed from the central types file
import type { ChampionMasteryDTO, LeagueEntryDTO, RiotSummonerDTO } from '@/types/ddragon';

// Cache durations
const CACHE_DURATION_RIOT_ID_DB_MILLISECONDS = 7 * 24 * 60 * 60 * 1000; // 7 days
const CACHE_DURATION_SUMMONER_REDIS_SECONDS = 5 * 60; // 5 minutes
const CACHE_DURATION_SUMMONER_DB_MILLISECONDS = 30 * 60 * 1000; // 30 minutes
const CACHE_DURATION_RANKED_ENTRIES_REDIS_SECONDS = 10 * 60; // 10 minutes for ranked data
const CACHE_DURATION_MASTERY_REDIS_SECONDS = 30 * 60;

// Define the return type for getProfileByRiotId
type ProfileData = RiotSummonerDTO & { 
  fetchedFrom: string; 
};

interface RiotIdSuggestion {
    gameName: string;
    tagLine: string;
    puuid: string;
    profileIconId: number | null; 
}

export const playerRouter = router({
  getProfileByRiotId: publicProcedure
    .input(
      z.object({
        gameName: z.string().min(1, "Game name cannot be empty."),
        tagLine: z.string().min(1, "Tag line cannot be empty."),
        platformId: z.string().min(2, "Platform ID is required."),
      })
    )
    .query(async ({ ctx, input }): Promise<ProfileData> => {
        const { gameName, tagLine, platformId } = input;
        const { db, redis, riotApi } = ctx;
        const normalizedPlatformId = platformId.toLowerCase();

        let puuid: string | undefined;
        let needsVerification = false; 
        let currentName = gameName; 
        let currentTag = tagLine;  

        // --- Step 1: Check riotIdCache ---
        try {
          const riotIdRecord = await db.select({
              puuid: riotIdCache.puuid,
              lastVerified: riotIdCache.lastVerified
            })
            .from(riotIdCache)
            .where(and(
              eq(riotIdCache.gameName, gameName),
              eq(riotIdCache.tagLine, tagLine),
              eq(riotIdCache.platformId, normalizedPlatformId)
            ))
            .limit(1);

          if (riotIdRecord.length > 0) {
            const record = riotIdRecord[0];
            if ((Date.now() - record.lastVerified) < CACHE_DURATION_RIOT_ID_DB_MILLISECONDS) {
              console.log(`[CACHE HIT - RiotID to PUUID in DB - FRESH] ${gameName}#${tagLine} -> ${record.puuid}`);
              puuid = record.puuid;
              needsVerification = false; 
            } else {
              console.log(`[CACHE STALE - RiotID to PUUID in DB] ${gameName}#${tagLine} -> ${record.puuid}. Marking for verification.`);
              puuid = record.puuid;
              needsVerification = true; 
            }
          } else {
            console.log(`[CACHE MISS - RiotID to PUUID in DB] ${gameName}#${tagLine}. Marking for fetch & verification.`);
            needsVerification = true;
          }
        } catch (err: any) {
            console.error(`DB SELECT error for riotIdCache for ${gameName}#${tagLine}:`, err.message);
            needsVerification = true; 
        }

        if (!puuid && needsVerification) { 
          console.log(`[API CALL - RiotID to PUUID] Fetching PUUID for ${gameName}#${tagLine} via riotApi service.`);
          try {
            const fetchedPuuid = await riotApi.getPuuidByRiotId(gameName, tagLine, normalizedPlatformId);
            puuid = fetchedPuuid;
            await db.insert(riotIdCache)
              .values({ gameName, tagLine, platformId: normalizedPlatformId, puuid, lastVerified: Date.now() })
              .onConflictDoNothing() 
              .catch((dbErr: any) => console.error(`DB INSERT error for riotIdCache (${gameName}#${tagLine}):`, dbErr.message));
          } catch (error: any) {
            console.error(`Error fetching PUUID via riotApi service for ${gameName}#${tagLine}:`, error.message);
            if (error instanceof TRPCError) throw error;
            const errorCode = (error as any)?.response?.status; 
            const message = errorCode === 404 ? `Player ${gameName}#${tagLine} not found on region ${normalizedPlatformId}.` : `Could not find player: ${gameName}#${tagLine}. API error.`;
            throw new TRPCError({ code: errorCode === 404 ? 'NOT_FOUND' : 'BAD_REQUEST', message });
          }
        }

        if (!puuid) { throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Critical error: PUUID could not be determined.' }); }

        if (needsVerification) {
          try {
            console.log(`[VERIFY ACCOUNT] Fetching current account data for PUUID: ${puuid}`);
            const currentAccountData = await riotApi.getAccountByPuuid(puuid, normalizedPlatformId); 
            if (currentAccountData?.gameName && currentAccountData?.tagLine) {
                const verifiedName = currentAccountData.gameName;
                const verifiedTag = currentAccountData.tagLine;
                console.log(`[VERIFY ACCOUNT] Verified Riot ID for PUUID ${puuid} is ${verifiedName}#${verifiedTag}`);

                currentName = verifiedName;
                currentTag = verifiedTag;

                await db.insert(riotIdCache)
                  .values({ gameName: verifiedName, tagLine: verifiedTag, platformId: normalizedPlatformId, puuid: puuid, lastVerified: Date.now() })
                  .onConflictDoUpdate({ target: [riotIdCache.gameName, riotIdCache.tagLine, riotIdCache.platformId], set: { puuid: puuid, lastVerified: Date.now() } })
                  .catch((dbErr: any) => console.error(`DB UPSERT error for current riotIdCache (${verifiedName}#${verifiedTag}):`, dbErr.message));

                if ((verifiedName !== gameName || verifiedTag !== tagLine)) {
                    console.log(`[CACHE UPDATE] Riot ID changed for PUUID ${puuid}. Old: ${gameName}#${tagLine}, Current: ${verifiedName}#${verifiedTag}. Removing old entry if it exists for this PUUID.`);
                    await db.delete(riotIdCache).where(and(
                        eq(riotIdCache.gameName, gameName), 
                        eq(riotIdCache.tagLine, tagLine),  
                        eq(riotIdCache.platformId, normalizedPlatformId),
                        eq(riotIdCache.puuid, puuid) 
                    )).catch((dbErr: any) => console.error(`DB DELETE error for old riotIdCache (${gameName}#${tagLine}):`, dbErr.message));
                }
            } else {
                 console.warn(`[VERIFY ACCOUNT] Could not fetch current account data for PUUID: ${puuid}. Using originally searched name/tag for profile cache checks.`);
            }
          } catch (error: any) {
            console.error(`[VERIFY ACCOUNT] Error fetching account data for PUUID ${puuid}:`, error.message);
          }
        }

        const summonerRedisKey = `player:profile:${normalizedPlatformId}:${puuid}`;
        if (redis) {
          try {
            const cachedValue: string | null | object = await redis.get(summonerRedisKey); 
            if (cachedValue) {
                let cachedPlayerData: ProfileData;
                if (typeof cachedValue === 'string') {
                    cachedPlayerData = JSON.parse(cachedValue) as ProfileData;
                } else { 
                    cachedPlayerData = cachedValue as ProfileData;
                }

                if (cachedPlayerData.name === currentName) { 
                    console.log(`[CACHE HIT - Summoner Profile in Redis] PUUID: ${puuid}`);
                    return { ...cachedPlayerData, puuid: cachedPlayerData.puuid || puuid }; 
                } else {
                    console.log(`[CACHE STALE - Summoner Profile in Redis due to name mismatch] PUUID: ${puuid}. Cached Name: ${cachedPlayerData.name}, Current/Verified Name: ${currentName}`);
                    await redis.del(summonerRedisKey).catch(e => console.error("Redis DEL error:", e));
                }
            }
          } catch (err: any) { console.error(`Redis GET/PARSE error for ${summonerRedisKey}:`, err.message); }
        }

        try {
          const summonerDbResult = await db.select().from(playerCache).where(eq(playerCache.puuid, puuid)).limit(1);
          if (summonerDbResult.length > 0) {
            const record = summonerDbResult[0];
            const playerDataFromDb = record.data as ProfileData; 

            if (!playerDataFromDb.name) {
                console.warn(`[DB DATA INTEGRITY] Name field is missing in playerCache.data for PUUID: ${puuid}. Forcing API refresh. DB Record:`, JSON.stringify(record));
            }

            if ((Date.now() - record.lastFetched) < CACHE_DURATION_SUMMONER_DB_MILLISECONDS &&
                playerDataFromDb.name && playerDataFromDb.name === currentName) 
            {
              console.log(`[CACHE HIT - Summoner Profile in DB] PUUID: ${puuid}`);
              if (redis && playerDataFromDb) { 
                redis.set(summonerRedisKey, JSON.stringify(playerDataFromDb), { ex: CACHE_DURATION_SUMMONER_REDIS_SECONDS })
                     .catch((setErr: any) => console.error(`Redis SET error (DB hit) for ${summonerRedisKey}:`, setErr.message)); 
              }
              return { ...playerDataFromDb, puuid: record.puuid }; 
            } else {
                let reason = (Date.now() - record.lastFetched) >= CACHE_DURATION_SUMMONER_DB_MILLISECONDS ? 'Time Expired' : '';
                if (!playerDataFromDb.name) reason += (reason ? ', ' : '') + 'Name Missing in DB';
                else if (playerDataFromDb.name !== currentName) reason += (reason ? ', ' : '') + 'Name Mismatch';
                console.log(`[CACHE STALE - Summoner Profile in DB] PUUID: ${puuid}. Reason: ${reason || 'Unknown (forcing refresh)'}. Cached Name: ${playerDataFromDb.name}, Current/Verified Name: ${currentName}`);
            }
          }
        } catch (err: any) { console.error(`DB SELECT error for playerCache PUUID ${puuid}:`, err.message); }

        try {
          console.log(`[API CALL - Summoner Profile] Fetching Summoner Data for PUUID: ${puuid}`);
          const freshSummonerDataFromApi = await riotApi.getSummonerByPuuid(puuid, normalizedPlatformId);
          
          console.log("[API DATA LOG] Fresh summoner data from API:", JSON.stringify(freshSummonerDataFromApi));

          const nameForCache = freshSummonerDataFromApi.name || currentName;
          if (!freshSummonerDataFromApi.name) {
            console.warn(`[API DATA WARNING] Summoner name missing from API response for PUUID: ${puuid}. Using current/verified name "${currentName}" for cache. Response:`, JSON.stringify(freshSummonerDataFromApi));
          }
          
          const dataToCache: ProfileData = {
            id: freshSummonerDataFromApi.id,
            accountId: freshSummonerDataFromApi.accountId,
            puuid: freshSummonerDataFromApi.puuid,
            name: nameForCache, 
            profileIconId: freshSummonerDataFromApi.profileIconId,
            revisionDate: freshSummonerDataFromApi.revisionDate,
            summonerLevel: freshSummonerDataFromApi.summonerLevel,
            fetchedFrom: 'Riot API' 
          };
          
          console.log("[CACHE PREP] Object to be cached (dataToCache):", JSON.stringify(dataToCache));

          await db.insert(playerCache)
            .values({
              puuid: puuid, 
              data: dataToCache, 
              lastFetched: Date.now(), 
              region: normalizedPlatformId,
              lastKnownGameName: currentName, 
              lastKnownTagLine: currentTag,  
            })
            .onConflictDoUpdate({ 
              target: playerCache.puuid, 
              set: { 
                data: dataToCache, 
                lastFetched: Date.now(), 
                region: normalizedPlatformId, 
                lastKnownGameName: currentName, 
                lastKnownTagLine: currentTag 
              } 
            })
            .catch((dbErr: any) => console.error(`DB INSERT/UPDATE error for playerCache PUUID ${puuid}:`, dbErr.message));

          if (redis) { 
            await redis.set(summonerRedisKey, JSON.stringify(dataToCache), { ex: CACHE_DURATION_SUMMONER_REDIS_SECONDS })
                       .catch((redisErr: any) => console.error(`Redis SET error (API fetch) for ${summonerRedisKey}:`, redisErr.message)); 
          }
          return dataToCache;
        } catch (error: any) {
            console.error(`Error fetching Summoner/Account Data via riotApi service or caching for PUUID ${puuid}:`, error.message);
            const dbResultStale = await db.select().from(playerCache).where(eq(playerCache.puuid, puuid)).limit(1).catch(e => { console.error("DB fallback read error:", e); return []; });
            if (dbResultStale.length > 0 && dbResultStale[0].data) {
              console.warn(`[API ERROR FALLBACK] Serving stale DB data for PUUID ${puuid}`);
              const staleData = dbResultStale[0].data as ProfileData;
              return { ...staleData, puuid: dbResultStale[0].puuid, fetchedFrom: 'Database Cache (Stale - API Error)' };
            }
            if (error instanceof TRPCError) throw error;
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Failed to fetch player profile: ${error.message}` });
        }
    }),

  getRankedEntries: publicProcedure
    .input(z.object({ summonerId: z.string().min(1), platformId: z.string().min(2) }))
    .query(async ({ ctx, input }): Promise<LeagueEntryDTO[]> => {
        const { summonerId, platformId } = input;
        const { redis, riotApi } = ctx;
        const normalizedPlatformId = platformId.toLowerCase();
        const redisKey = `player:ranked:${normalizedPlatformId}:${summonerId}`;

        if (redis) {
          try {
            const cachedValue: string | null | object = await redis.get(redisKey);
            if (cachedValue) {
              if (typeof cachedValue === 'string') {
                return JSON.parse(cachedValue) as LeagueEntryDTO[];
              }
              return cachedValue as LeagueEntryDTO[];
            }
          } catch (err: any) { console.error(`Redis GET/PARSE error for ${redisKey}:`, err.message); }
        }

        try {
          const freshRankedData = await riotApi.getLeagueEntriesBySummonerId(summonerId, normalizedPlatformId);
          if (redis) { 
            await redis.set(redisKey, JSON.stringify(freshRankedData), { ex: CACHE_DURATION_RANKED_ENTRIES_REDIS_SECONDS })
                       .catch((redisErr: any) => console.error(`Redis SET error (API fetch) for ${redisKey}:`, redisErr.message)); 
          }
          return freshRankedData;
        } catch (error: any) {
            console.error(`Error fetching Ranked Entries via riotApi service or caching for SummonerID ${summonerId}:`, error.message);
            if (error instanceof TRPCError) throw error;
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Failed to fetch ranked entries: ${error.message}` });
        }
    }),

  // New procedure to get ranked entries for multiple summoners
  getBulkRankedEntries: publicProcedure
    .input(
      z.object({
        summonerInputs: z.array(
          z.object({
            summonerId: z.string().min(1),
            platformId: z.string().min(2), // Platform ID for each summoner, in case they could be different
          })
        ).min(1, "At least one summoner input is required."),
      })
    )
    .query(async ({ ctx, input }): Promise<Record<string, LeagueEntryDTO[] | null>> => {
      const { summonerInputs } = input;
      const { redis, riotApi } = ctx;
      const results: Record<string, LeagueEntryDTO[] | null> = {};

      // Process all summoner inputs concurrently
      await Promise.allSettled(summonerInputs.map(async ({ summonerId, platformId }) => {
        const normalizedPlatformId = platformId.toLowerCase();
        const redisKey = `player:ranked:${normalizedPlatformId}:${summonerId}`;
        let summonerRankedData: LeagueEntryDTO[] | null = null;

        if (redis) {
          try {
            const cachedValue: string | null | object = await redis.get(redisKey);
            if (cachedValue) {
              if (typeof cachedValue === 'string') {
                summonerRankedData = JSON.parse(cachedValue) as LeagueEntryDTO[];
              } else { // Assuming it's already an object
                summonerRankedData = cachedValue as LeagueEntryDTO[];
              }
              // console.log(`[CACHE HIT - Redis Bulk] Ranked for ${summonerId}`);
            }
          } catch (err: any) {
            console.error(`Redis GET/PARSE error in bulk for ${redisKey}:`, err.message);
          }
        }

        if (!summonerRankedData) { // If not found in cache, fetch from API
          try {
            // console.log(`[API CALL - Bulk Ranked] Fetching for ${summonerId} on ${normalizedPlatformId}`);
            summonerRankedData = await riotApi.getLeagueEntriesBySummonerId(summonerId, normalizedPlatformId);
            if (redis && summonerRankedData) { 
              // Ensure data is stringified before setting in Redis
              await redis.set(redisKey, JSON.stringify(summonerRankedData), { ex: CACHE_DURATION_RANKED_ENTRIES_REDIS_SECONDS })
                .catch((redisErr: any) => console.error(`Redis SET error (API fetch bulk) for ${redisKey}:`, redisErr.message));
            }
          } catch (error: any) {
            console.error(`Error fetching Ranked Entries in bulk for SummonerID ${summonerId}:`, error.message);
            summonerRankedData = null; // Set to null on error for this specific summoner
          }
        }
        results[summonerId] = summonerRankedData;
      }));
      
      return results;
    }),

  getChampionMastery: publicProcedure
    .input(z.object({ puuid: z.string().min(20), platformId: z.string().min(2) }))
    .query(async ({ ctx, input }): Promise<ChampionMasteryDTO[]> => {
      const { puuid, platformId } = input;
      const { redis, riotApi } = ctx;
      const normalizedPlatformId = platformId.toLowerCase();
      const redisKey = `player:mastery:${normalizedPlatformId}:${puuid}`;

      if (redis) {
        try {
          const cachedValue: string | null | object = await redis.get(redisKey);
          if (cachedValue) {
            if (typeof cachedValue === 'string') {
              return JSON.parse(cachedValue) as ChampionMasteryDTO[];
            }
            return cachedValue as ChampionMasteryDTO[];
          }
        } catch (err: any) { console.error(`Redis GET/PARSE error for ${redisKey}:`, err.message); }
      }
      try {
        const freshMasteryData = await riotApi.getChampionMasteryByPuuid(puuid, normalizedPlatformId);
        if (redis) { 
            await redis.set(redisKey, JSON.stringify(freshMasteryData), { ex: CACHE_DURATION_MASTERY_REDIS_SECONDS })
                       .catch((redisErr: any) => console.error(`Redis SET error (API fetch) for ${redisKey}:`, redisErr.message)); 
        }
        return freshMasteryData;
      } catch (error: any) {
        console.error(`Error fetching Champion Mastery via riotApi service or caching for PUUID ${puuid}:`, error.message);
        if (error instanceof TRPCError) throw error;
        console.warn(`Failed to fetch mastery for PUUID ${puuid}, returning empty array.`);
        return [];
      }
    }),

  searchRiotIds: publicProcedure
    .input(
      z.object({
        query: z.string().min(1),
        platformId: z.string().min(2),
        limit: z.number().min(1).max(10).optional().default(5),
      })
    )
    .query(async ({ ctx, input }): Promise<RiotIdSuggestion[]> => {
      const { query, platformId, limit } = input;
      const { db } = ctx;
      const normalizedPlatformId = platformId.toLowerCase();

      try {
        const results = await db
          .select({
            gameName: riotIdCache.gameName,
            tagLine: riotIdCache.tagLine,
            puuid: riotIdCache.puuid,
            profileIconId: sql<number | null>`(${playerCache.data} ->> 'profileIconId')::integer`.mapWith(value => value === null ? null : Number(value)),
          })
          .from(riotIdCache)
          .leftJoin(playerCache, eq(riotIdCache.puuid, playerCache.puuid))
          .where(
            and(
              eq(riotIdCache.platformId, normalizedPlatformId),
              sql`lower(${riotIdCache.gameName}) like ${query.toLowerCase() + '%'}`
            )
          )
          .orderBy(desc(riotIdCache.lastVerified))
          .limit(limit);

        return results.map(r => ({
            gameName: r.gameName,
            tagLine: r.tagLine,
            puuid: r.puuid,
            profileIconId: r.profileIconId 
        }));

      } catch (error: any) {
        console.error(`DB SEARCH error for riotIdCache query "${query}":`, error.message);
        return [];
      }
    }),
});
