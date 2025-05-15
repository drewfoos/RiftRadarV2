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
  // Using @ts-expect-error as per ESLint rule, assuming these properties are not standard on Error
  // and we are intentionally shaping it like a TRPCClientError.
  // @ts-expect-error Property 'data' does not exist on type 'Error'.
  error.data = { httpStatus: null, code: code || 'CLIENT_VALIDATION_ERROR', path: 'match.getMatchDetails' };
  // @ts-expect-error Property 'shape' does not exist on type 'Error'.
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
  // --- Call Hooks at the Top Level ---
  const trpcClient = useTRPC(); // Hook called unconditionally

  // Determine if inputs are valid for a query
  const isMatchIdValidForQuery = typeof matchId === 'string' && matchId.trim().length >= 5;
  const isPlatformIdValidForQuery = typeof platformId === 'string' && platformId.trim().length >= 2;
  const isQueryEnabled = isMatchIdValidForQuery && isPlatformIdValidForQuery;

  const matchDetailsQueryOptions = trpcClient.match.getMatchDetails.queryOptions(
    // Pass valid or potentially invalid inputs; `enabled` flag controls the fetch
    { matchId, platformId },
    {
      staleTime: 15 * 60 * 1000,
      gcTime: 60 * 60 * 1000,
      enabled: isQueryEnabled, // Query will only run if inputs are valid
      refetchOnWindowFocus: false,
      retry: 1,
    }
  );

  const {
    data: matchDetails,
    isLoading,
    error,
    isFetching,
  } = useQuery(matchDetailsQueryOptions); // Hook called unconditionally

  // --- Conditional Logic and Early Returns (after hooks) ---

  // Handle cases where inputs are fundamentally invalid (even before query attempts)
  if (!isMatchIdValidForQuery) {
    console.warn(`[MatchDisplaySwitcher] Invalid matchId prop: '${matchId}'. Min length 5 required. Not fetching. Calling onFetchError.`);
    // Call onFetchError effectfully, but outside of render logic if possible, or ensure it's idempotent
    // For simplicity here, directly calling. Consider useEffect for side effects if this causes issues.
    onFetchError?.(matchId || "unknown_invalid_id", createClientSideError(matchId || "unknown_invalid_id", `Invalid matchId: '${matchId}'. Min length 5 required.`, 'INVALID_INPUT_MATCHID'));
    return null;
  }
  if (!isPlatformIdValidForQuery) {
    // This implies matchId was okay, but platformId is not.
    console.warn(`[MatchDisplaySwitcher] Invalid platformId prop: '${platformId}' for matchId '${matchId}'. Min length 2 required. Not fetching. Calling onFetchError.`);
    onFetchError?.(matchId, createClientSideError(matchId, `Invalid platformId: '${platformId}'. Min length 2 required.`, 'INVALID_INPUT_PLATFORMID'));
    return null;
  }
  // At this point, inputs were valid enough for the query to be potentially enabled.

  const typedError = error as TRPCClientErrorLike<AppRouter> | null;

  // --- Loading State ---
  // Show loading skeleton if the query is enabled and actively loading/fetching.
  if (isQueryEnabled && (isLoading || (isFetching && !matchDetails && !typedError))) {
    return (
      <Card className="mb-3 animate-pulse bg-slate-800/50 p-3 rounded-lg shadow-md h-[76px]">
        <div className="h-5 bg-slate-700 rounded w-3/4 mb-2"></div>
        <div className="h-4 bg-slate-700 rounded w-1/2"></div>
      </Card>
    );
  }

  // --- Error State (from API fetch, query must have been enabled and ran) ---
  if (typedError) {
    console.log(`[MatchDisplaySwitcher] API Error for matchId '${matchId}'. Error object:`, JSON.parse(JSON.stringify(typedError)));
    if (onFetchError) {
        console.log(`[MatchDisplaySwitcher] Calling onFetchError for matchId '${matchId}' due to API error.`);
        onFetchError(matchId, typedError);
    } else {
        console.warn(`[MatchDisplaySwitcher] onFetchError is undefined for matchId '${matchId}', cannot report API error.`);
    }
    return null;
  }

  // --- Data Unavailable State (after successful fetch, but no data returned, query must have been enabled) ---
  if (isQueryEnabled && !isLoading && !typedError && !matchDetails) {
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

  // Fallback: Data is truthy but info field is missing (query must have been enabled)
  if (isQueryEnabled && matchDetails && !matchDetails.info) {
    console.warn(`[MatchDisplaySwitcher] Fallback: Match data present for '${matchId}' but no 'info' field. Calling onFetchError.`);
    onFetchError?.(matchId, createClientSideError(matchId, `Match data for ${matchId} was incomplete (missing 'info').`, 'INCOMPLETE_DATA'));
    return null;
  }
  
  // Final catch-all: If the query was disabled from the start because inputs were invalid,
  // and the early returns for invalid props were somehow bypassed (should not happen with current logic),
  // or if some other unhandled state occurs.
  if (!isQueryEnabled) {
    // This case should ideally be caught by the initial prop validation returns.
    // If it's reached, it means the query was never enabled, and no data/error would be present from it.
    console.log(`[MatchDisplaySwitcher] Query was not enabled for matchId '${matchId}'. Returning null.`);
    // Not calling onFetchError here as it should have been called by the earlier validation checks.
    return null;
  }
  
  console.log(`[MatchDisplaySwitcher] Reached final null return for matchId '${matchId}'. This may indicate an unhandled case.`);
  return null;
}
