// src/lib/riotApiService.ts
import { TRPCError } from '@trpc/server';
import { Ratelimit } from '@upstash/ratelimit';
import 'dotenv/config';
import { redis } from './redis';
// Import necessary types from the central types file
import type { ChampionMasteryDTO, LeagueEntryDTO, RiotSummonerDTO } from '@/types/ddragon';
// Import Spectator V5 types
import type { CurrentGameInfo } from '@/types/spectatorV5'; // Adjust path if you place it elsewhere

const RIOT_API_KEY = process.env.RIOT_API_KEY;

// --- Rate Limiter Setup ---
if (!redis) {
  console.warn(
    "Upstash Redis client is not initialized for RiotApiService. Rate limiting will be disabled or might throw errors."
  );
}
const riotApiSecondLimiter = redis
  ? new Ratelimit({
      redis: redis,
      limiter: Ratelimit.slidingWindow(20, '1s'),
      prefix: 'ratelimit:riotapi:second:service',
      analytics: true,
    })
  : null;
const riotApiMinuteLimiter = redis
  ? new Ratelimit({
      redis: redis,
      limiter: Ratelimit.slidingWindow(100, '120s'),
      prefix: 'ratelimit:riotapi:minute:service',
      analytics: true,
    })
  : null;

// --- Rate Limit Helper ---
async function ensureRateLimit(identifier: string = "global_riot_api_service_user") {
    if (!riotApiSecondLimiter || !riotApiMinuteLimiter) {
      console.warn("Rate limiters are not initialized in RiotApiService. Skipping rate limit check.");
      return;
    }
    try {
      const { success: successSecond, remaining: remainingSecond } = await riotApiSecondLimiter.limit(identifier);
      if (!successSecond) {
        console.warn(`Riot API Service: Rate limit exceeded (per second) for ${identifier}. Remaining: ${remainingSecond}`);
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: 'Riot API rate limit exceeded (per second). Please try again shortly.',
        });
      }
      const { success: successMinute, remaining: remainingMinute } = await riotApiMinuteLimiter.limit(identifier);
      if (!successMinute) {
        console.warn(`Riot API Service: Rate limit exceeded (per 2 minutes) for ${identifier}. Remaining: ${remainingMinute}`);
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: 'Riot API rate limit exceeded (per 2 minutes). Please try again later.',
        });
      }
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      console.error("Riot API Service: Error during rate limit check:", error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while checking API rate limits.',
        cause: error,
      });
    }
  }

// --- Riot API Call Helper Functions ---
function getAccountV1RegionRoute(platformId: string): string {
  const lowerId = platformId.toLowerCase();
  if (['na1', 'br1', 'la1', 'la2', 'oc1'].includes(lowerId)) return 'americas';
  if (['eun1', 'euw1', 'tr1', 'ru'].includes(lowerId)) return 'europe';
  if (['kr', 'jp1'].includes(lowerId)) return 'asia';
  if (['ph2', 'sg2', 'th2', 'tw2', 'vn2'].includes(lowerId)) return 'sea';
  console.warn(`Unsupported platformId '${platformId}' for Account-V1 regional routing. Defaulting to 'americas'.`);
  return 'americas';
}
function getPlatformApiHost(platformId: string): string {
  return `${platformId.toLowerCase()}.api.riotgames.com`;
}
function getMatchV5ApiRegion(platformId: string): string {
  const lowerId = platformId.toLowerCase();
  if (['na1', 'br1', 'la1', 'la2'].includes(lowerId)) return 'americas';
  if (['eun1', 'euw1', 'tr1', 'ru', 'oc1'].includes(lowerId)) return 'europe';
  if (['kr', 'jp1'].includes(lowerId)) return 'asia';
  if (['ph2', 'sg2', 'th2', 'tw2', 'vn2'].includes(lowerId)) return 'sea';
  console.warn(`Unsupported platformId '${platformId}' for Match-V5 regional routing. Defaulting to 'americas'.`);
  return 'americas';
}
// No specific regional routing for SPECTATOR-V5, it uses platform routing.

export const riotApiService = {
  // --- Existing Methods ---
  async getPuuidByRiotId(gameName: string, tagLine: string, platformId: string): Promise<string> {
    await ensureRateLimit(`riotId:${gameName}-${tagLine}-${platformId}`);
    if (!RIOT_API_KEY) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Riot API Key not configured.' });
    const accountV1ApiRegion = getAccountV1RegionRoute(platformId);
    const url = `https://${accountV1ApiRegion}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}?api_key=${RIOT_API_KEY}`;
    console.log(`RiotApiService: Fetching PUUID from Riot ID: ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`RiotApiService: ACCOUNT-V1 API error for ${gameName}#${tagLine}: ${response.status} ${response.statusText}`, errorBody);
      throw new TRPCError({ code: 'NOT_FOUND', message: `Player ${gameName}#${tagLine} not found or API error (${response.status}).` });
    }
    const data = await response.json();
    if (!data.puuid) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'PUUID not found in Riot API response.' });
    return data.puuid as string;
  },

  async getSummonerByPuuid(puuid: string, platformId: string): Promise<RiotSummonerDTO & { level: number; fetchedFrom: string }> {
    await ensureRateLimit(`summoner:${puuid}-${platformId}`);
    if (!RIOT_API_KEY) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Riot API Key not configured.' });
    const summonerApiHost = getPlatformApiHost(platformId);
    const url = `https://${summonerApiHost}/lol/summoner/v4/summoners/by-puuid/${puuid}?api_key=${RIOT_API_KEY}`;
    console.log(`RiotApiService: Fetching Summoner Data by PUUID: ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`RiotApiService: SUMMONER-V4 API error for PUUID ${puuid}: ${response.status} ${response.statusText}`, errorBody);
      const message = response.status === 400 && errorBody.includes("Exception decrypting")
        ? `Invalid PUUID for LoL summoner data or Bad Request (${response.status}).`
        : `Failed to fetch summoner data for PUUID (${response.status}).`;
      throw new TRPCError({ code: response.status === 404 ? 'NOT_FOUND' : 'INTERNAL_SERVER_ERROR', message });
    }
    const data: RiotSummonerDTO = await response.json();
    return {
        ...data,
        level: data.summonerLevel, 
        fetchedFrom: 'Riot API',
    };
  },

  async getAccountByPuuid(puuid: string, platformId: string): Promise<{ gameName?: string; tagLine?: string } | null> {
    await ensureRateLimit(`account:${puuid}-${platformId}`);
    if (!RIOT_API_KEY) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Riot API Key not configured.' });
    const accountV1ApiRegion = getAccountV1RegionRoute(platformId);
    const url = `https://${accountV1ApiRegion}.api.riotgames.com/riot/account/v1/accounts/by-puuid/${puuid}?api_key=${RIOT_API_KEY}`;
    console.log(`RiotApiService: Fetching Account Data by PUUID: ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`RiotApiService: ACCOUNT-V1 by PUUID API error for PUUID ${puuid}: ${response.status} ${response.statusText}`, errorBody);
      return null;
    }
    const data = await response.json();
    return { gameName: data.gameName as string | undefined, tagLine: data.tagLine as string | undefined };
  },

  async getLeagueEntriesBySummonerId(summonerId: string, platformId: string): Promise<LeagueEntryDTO[]> {
    await ensureRateLimit(`leagueEntries:${summonerId}-${platformId}`);
    if (!RIOT_API_KEY) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Riot API Key not configured.' });
    }
    const apiHost = getPlatformApiHost(platformId);
    const url = `https://${apiHost}/lol/league/v4/entries/by-summoner/${summonerId}?api_key=${RIOT_API_KEY}`;
    console.log(`RiotApiService: Fetching League Entries by Summoner ID: ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`RiotApiService: LEAGUE-V4 API error for Summoner ID ${summonerId}: ${response.status} ${response.statusText}`, errorBody);
      if (response.status === 404) {
        return []; 
      }
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Failed to fetch league entries for Summoner ID ${summonerId} (${response.status}).`,
      });
    }
    const data = await response.json();
    return data as LeagueEntryDTO[];
  },

  async getMatchIdsByPuuid(puuid: string, platformId: string, options?: { startTime?: number; endTime?: number; queue?: number; type?: string; start?: number; count?: number; }): Promise<string[]> {
    await ensureRateLimit(`matchIds:${puuid}-${platformId}`);
    if (!RIOT_API_KEY) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Riot API Key not configured.' });
    const apiRegion = getMatchV5ApiRegion(platformId);
    const queryParams = new URLSearchParams();
    if (options?.startTime) queryParams.append('startTime', String(options.startTime));
    if (options?.endTime) queryParams.append('endTime', String(options.endTime));
    if (options?.queue) queryParams.append('queue', String(options.queue));
    if (options?.type) queryParams.append('type', options.type);
    queryParams.append('start', String(options?.start || 0));
    queryParams.append('count', String(options?.count || 20));
    const url = `https://${apiRegion}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?${queryParams.toString()}&api_key=${RIOT_API_KEY}`;
    console.log(`RiotApiService: Fetching Match IDs: ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`RiotApiService: MATCH-V5 (IDs) API error for PUUID ${puuid} on region ${apiRegion}: ${response.status} ${response.statusText}`, errorBody);
      if (response.status === 404) {
          return [];
      }
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Failed to fetch match IDs (${response.status}).` });
    }
    return await response.json() as string[];
  },

  async getMatchDetails(matchId: string, platformId: string): Promise<any> { // Consider defining a proper MatchDetails type
    await ensureRateLimit(`matchDetails:${matchId}-${platformId}`);
    if (!RIOT_API_KEY) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Riot API Key not configured.' });
    const apiRegion = getMatchV5ApiRegion(platformId);
    const url = `https://${apiRegion}.api.riotgames.com/lol/match/v5/matches/${matchId}?api_key=${RIOT_API_KEY}`;
    console.log(`RiotApiService: Fetching Match Details: ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`RiotApiService: MATCH-V5 (Details) API error for MatchID ${matchId} on region ${apiRegion}: ${response.status} ${response.statusText}`, errorBody);
      throw new TRPCError({ code: response.status === 404 ? 'NOT_FOUND' : 'INTERNAL_SERVER_ERROR', message: `Failed to fetch match details for ${matchId} (${response.status}).` });
    }
    const data = await response.json();
    return { ...data, fetchedFrom: 'Riot API' };
  },

  async getChampionMasteryByPuuid(puuid: string, platformId: string): Promise<ChampionMasteryDTO[]> {
    await ensureRateLimit(`champMastery:${puuid}-${platformId}`);
    if (!RIOT_API_KEY) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Riot API Key not configured.' });
    }
    const apiHost = getPlatformApiHost(platformId);
    const url = `https://${apiHost}/lol/champion-mastery/v4/champion-masteries/by-puuid/${puuid}?api_key=${RIOT_API_KEY}`;
    console.log(`RiotApiService: Fetching Champion Mastery by PUUID: ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`RiotApiService: CHAMPION-MASTERY-V4 API error for PUUID ${puuid}: ${response.status} ${response.statusText}`, errorBody);
      if (response.status === 404) {
        return [];
      }
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Failed to fetch champion mastery for PUUID ${puuid} (${response.status}).`,
      });
    }
    const data = await response.json();
    return data as ChampionMasteryDTO[];
  },

  // --- New Spectator V5 Method ---
  async getCurrentGameInfoByPuuid(puuid: string, platformId: string): Promise<CurrentGameInfo | null> {
    await ensureRateLimit(`spectator:${puuid}-${platformId}`);
    if (!RIOT_API_KEY) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Riot API Key not configured.' });
    }
    const apiHost = getPlatformApiHost(platformId); // Spectator API uses platform routing
    const url = `https://${apiHost}/lol/spectator/v5/active-games/by-summoner/${puuid}?api_key=${RIOT_API_KEY}`;
    console.log(`RiotApiService: Fetching Current Game Info by PUUID: ${url}`);

    const response = await fetch(url);

    if (response.status === 404) {
      console.log(`RiotApiService: No active game found for PUUID ${puuid} on ${platformId}.`);
      return null; // Player is not in an active game
    }

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`RiotApiService: SPECTATOR-V5 API error for PUUID ${puuid}: ${response.status} ${response.statusText}`, errorBody);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Failed to fetch current game info for PUUID ${puuid} (${response.status}).`,
      });
    }
    const data = await response.json();
    return data as CurrentGameInfo;
  },
};

export type RiotApiService = typeof riotApiService;
