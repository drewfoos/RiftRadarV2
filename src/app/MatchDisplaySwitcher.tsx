// app/MatchDisplaySwitcher.tsx
'use client';

import { Card } from '@/components/ui/card'; // Only Card is needed for loading state
import { useTRPC } from '@/trpc/client';
import type { AppRouter } from '@/trpc/routers/_app'; // Your tRPC AppRouter type
import { useQuery } from '@tanstack/react-query';
import type { TRPCClientError, TRPCClientErrorLike } from '@trpc/client';

// Import your specific display components
import { ArenaMatchDetails } from './ArenaMatchDetails';
import { ClassicMatchDetails } from './ClassicMatchDetails';

// Import shared Data Dragon & Riot API types
import type {
  DDragonArenaAugment,
  DDragonChampion,
  DDragonRuneTree,
  DDragonSummonerSpell
} from '@/types/ddragon';

// Helper to create a consistent client-side error object structure
function createClientSideError(matchId: string, message: string, code?: string): TRPCClientErrorLike<AppRouter> {
  const error = new Error(message) as TRPCClientError<AppRouter>;
  error.name = 'ClientSideError';
  // @ts-ignore
  error.data = { httpStatus: null, code: code || 'CLIENT_VALIDATION_ERROR', path: 'match.getMatchDetails' };
  // @ts-ignore
  error.shape = { message: error.message, code: -1, data: error.data }; // Simplified shape
  return error;
}

interface MatchDisplaySwitcherProps {
  matchId: string;
  platformId: string;
  searchedPlayerPuuid: string;
  currentPatchVersion: string;
  summonerSpellData?: Record<string, DDragonSummonerSpell>;
  runeTreeData?: DDragonRuneTree[];
  championData?: Record<string, DDragonChampion>;
  gameModeMap?: Record<number, string>;
  arenaAugmentData?: Record<number, DDragonArenaAugment>;
  onFetchError?: (matchId: string, error: TRPCClientErrorLike<AppRouter>) => void;
}

export function MatchDisplaySwitcher({
  matchId,
  platformId,
  searchedPlayerPuuid,
  currentPatchVersion,
  summonerSpellData,
  runeTreeData,
  championData,
  gameModeMap,
  arenaAugmentData,
  onFetchError
}: MatchDisplaySwitcherProps) {

  const isMatchIdValidForQuery = typeof matchId === 'string' && matchId.trim().length >= 5;
  const isPlatformIdValidForQuery = typeof platformId === 'string' && platformId.trim().length >= 2;
  const isQueryEnabled = isMatchIdValidForQuery && isPlatformIdValidForQuery;

  if (!isMatchIdValidForQuery) {
    console.warn(`[MatchDisplaySwitcher] Invalid matchId prop: '${matchId}'. Min length 5 required. Not fetching. Calling onFetchError.`);
    onFetchError?.(matchId || "unknown_invalid_id", createClientSideError(matchId || "unknown_invalid_id", `Invalid matchId: '${matchId}'. Min length 5 required.`, 'INVALID_INPUT_MATCHID'));
    return null;
  }
  if (!isPlatformIdValidForQuery) {
    console.warn(`[MatchDisplaySwitcher] Invalid platformId prop: '${platformId}' for matchId '${matchId}'. Min length 2 required. Not fetching. Calling onFetchError.`);
    onFetchError?.(matchId, createClientSideError(matchId, `Invalid platformId: '${platformId}'. Min length 2 required.`, 'INVALID_INPUT_PLATFORMID'));
    return null;
  }

  const trpcClient = useTRPC();

  const matchDetailsQueryOptions = trpcClient.match.getMatchDetails.queryOptions(
    { matchId, platformId },
    {
      staleTime: 15 * 60 * 1000,
      gcTime: 60 * 60 * 1000,
      enabled: isQueryEnabled,
      refetchOnWindowFocus: false,
      retry: 1, // Consider setting retry to 0 if API errors are common and you want to fail faster for the UI
    }
  );

  const {
    data: matchDetails,
    isLoading,
    error,
    isFetching,
  } = useQuery(matchDetailsQueryOptions);

  const typedError = error as TRPCClientErrorLike<AppRouter> | null;

  // --- Loading State ---
  if (isLoading || (isFetching && !matchDetails && !typedError)) {
    return (
      <Card className="mb-3 animate-pulse bg-slate-800/50 p-3 rounded-lg shadow-md h-[76px]">
        <div className="h-5 bg-slate-700 rounded w-3/4 mb-2"></div>
        <div className="h-4 bg-slate-700 rounded w-1/2"></div>
      </Card>
    );
  }

  // --- Error State (from API fetch) ---
  if (typedError) {
    // **** CRITICAL LOGGING ****
    console.log(`[MatchDisplaySwitcher] API Error for matchId '${matchId}'. Error object:`, JSON.parse(JSON.stringify(typedError))); // Log the error structure
    if (onFetchError) {
        console.log(`[MatchDisplaySwitcher] Calling onFetchError for matchId '${matchId}' due to API error.`);
        onFetchError(matchId, typedError);
    } else {
        console.warn(`[MatchDisplaySwitcher] onFetchError is undefined for matchId '${matchId}', cannot report API error.`);
    }
    return null;
  }

  // --- Data Unavailable State (after successful fetch, but no data returned) ---
  if (!isLoading && !typedError && !matchDetails) {
     console.warn(`[MatchDisplaySwitcher] No details found for matchId '${matchId}' after successful fetch (API returned no data). Calling onFetchError.`);
    onFetchError?.(matchId, createClientSideError(matchId, `No details found for matchId ${matchId} after fetch.`, 'NO_DATA_RETURNED'));
    return null;
  }

  // --- Render actual match details if data is available ---
  if (matchDetails?.info) {
    if (matchDetails.info.gameMode === 'CHERRY' || matchDetails.info.queueId === 1700) {
      return (
        <ArenaMatchDetails
          matchDetails={matchDetails}
          searchedPlayerPuuid={searchedPlayerPuuid}
          currentPatchVersion={currentPatchVersion}
          summonerSpellData={summonerSpellData}
          runeTreeData={runeTreeData}
          championData={championData}
          gameModeMap={gameModeMap}
          platformId={platformId}
          arenaAugmentData={arenaAugmentData}
        />
      );
    } else {
      return (
        <ClassicMatchDetails
          matchDetails={matchDetails}
          searchedPlayerPuuid={searchedPlayerPuuid}
          currentPatchVersion={currentPatchVersion}
          summonerSpellData={summonerSpellData}
          runeTreeData={runeTreeData}
          championData={championData}
          gameModeMap={gameModeMap}
          platformId={platformId}
        />
      );
    }
  }

  // Fallback: Data is truthy but info field is missing
  if (matchDetails && !matchDetails.info) {
    console.warn(`[MatchDisplaySwitcher] Fallback: Match data present for '${matchId}' but no 'info' field. Calling onFetchError.`);
    onFetchError?.(matchId, createClientSideError(matchId, `Match data for ${matchId} was incomplete (missing 'info').`, 'INCOMPLETE_DATA'));
    return null;
  }
  
  // Final catch-all if somehow none of the above conditions were met
  // (e.g. query was disabled and no early exit happened - though current logic should prevent this)
  console.log(`[MatchDisplaySwitcher] Reached final null return for matchId '${matchId}'. This may indicate an unhandled case.`);
  return null;
}
