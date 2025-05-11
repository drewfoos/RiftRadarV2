// app/MatchDisplaySwitcher.tsx
'use client';

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card } from '@/components/ui/card';
import { useTRPC } from '@/trpc/client'; // Assumes @/ is src/
import type { AppRouter } from '@/trpc/routers/_app';
import { useQuery } from '@tanstack/react-query';
import type { TRPCClientErrorLike } from '@trpc/client';
import { ShieldAlert } from 'lucide-react';

// Import your specific display components
import { ArenaMatchDetails } from './ArenaMatchDetails';
import { ClassicMatchDetails } from './ClassicMatchDetails';

// Import shared Data Dragon & Riot API types from your centralized file
import type {
  DDragonArenaAugment,
  DDragonChampion,
  DDragonRuneTree,
  DDragonSummonerSpell
} from '@/types/ddragon'; // Adjust path if your types file is src/types/ddragon.ts


// Props for MatchDisplaySwitcher
interface MatchDisplaySwitcherProps {
  matchId: string;
  platformId: string;
  searchedPlayerPuuid: string;
  currentPatchVersion: string;
  // Data Dragon asset mappings passed from PlayerProfileClient
  summonerSpellData?: Record<string, DDragonSummonerSpell>;
  runeTreeData?: DDragonRuneTree[];
  championData?: Record<string, DDragonChampion>;
  gameModeMap?: Record<number, string>;
  arenaAugmentData?: Record<number, DDragonArenaAugment>; // Added prop for arena augments
}

export function MatchDisplaySwitcher({
  matchId, platformId, searchedPlayerPuuid, currentPatchVersion,
  summonerSpellData, runeTreeData, championData, gameModeMap,
  arenaAugmentData // Destructure the new prop
}: MatchDisplaySwitcherProps) {
  const trpcClient = useTRPC();

  // Construct query options first to help TypeScript with inference
  const matchDetailsQueryOptions = trpcClient.match.getMatchDetails.queryOptions(
    { matchId, platformId }, // Input to your tRPC procedure
    { // TanStack Query options
      staleTime: 15 * 60 * 1000, // Data considered fresh for 15 minutes
      gcTime: 60 * 60 * 1000,    // Data kept in cache for 1 hour
      enabled: true, // Fetch immediately when the component mounts and inputs are valid
      refetchOnWindowFocus: false, // Don't refetch just because window got focus
      retry: 1, // Retry once on failure
    }
  );

  const {
    data: matchDetails, // Type should be inferred as MatchDetailsData | undefined from tRPC
    isLoading,
    error,
  } = useQuery(matchDetailsQueryOptions); // Pass the pre-constructed options object

  const typedError = error as TRPCClientErrorLike<AppRouter> | null;

  // Loading State
  if (isLoading) {
    return (
      <Card className="mb-3 animate-pulse bg-slate-800/50 p-3 rounded-lg shadow-md h-[76px]"> {/* Approx height of summary */}
        <div className="h-5 bg-slate-700 rounded w-3/4 mb-2"></div>
        <div className="h-4 bg-slate-700 rounded w-1/2"></div>
      </Card>
    );
  }

  // Error State
  if (typedError) {
    return (
      <Alert variant="destructive" className="mb-3 text-xs">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Error loading match: {matchId.substring(0,10)}...</AlertTitle>
        <AlertDescription>{typedError.message}</AlertDescription>
      </Alert>
    );
  }

  // Data Unavailable State (after loading & no error)
  if (!matchDetails) {
    return (
      <Card className="mb-3 p-3 rounded-lg shadow bg-slate-900 border border-slate-700">
        <p className="text-sm text-gray-400">No details found for match: {matchId.substring(0,10)}...</p>
        <p className="text-xs text-gray-500">Could be an API issue or data unavailable.</p>
      </Card>
    );
  }

  // --- Dispatch Logic ---
  // At this point, matchDetails is guaranteed to be of type MatchDetailsData
  // Dispatch based on gameMode or queueId
  // Riot API uses "CHERRY" for Arena game mode. QueueId 1700 is also Arena.
  if (matchDetails.info.gameMode === 'CHERRY' || matchDetails.info.queueId === 1700) {
    return (
      <ArenaMatchDetails
        matchDetails={matchDetails}
        searchedPlayerPuuid={searchedPlayerPuuid}
        currentPatchVersion={currentPatchVersion}
        summonerSpellData={summonerSpellData}
        // Pass runeTreeData down - ArenaMatchDetails needs it in props even if unused
        runeTreeData={runeTreeData}
        championData={championData}
        gameModeMap={gameModeMap}
        platformId={platformId}
        arenaAugmentData={arenaAugmentData} // Pass arena augment data
      />
    );
  } else {
    // For all other modes (CLASSIC, ARAM, etc.), use ClassicMatchDetails
    return (
      <ClassicMatchDetails
        matchDetails={matchDetails}
        searchedPlayerPuuid={searchedPlayerPuuid}
        currentPatchVersion={currentPatchVersion}
        summonerSpellData={summonerSpellData}
        runeTreeData={runeTreeData} // Pass rune data
        championData={championData}
        gameModeMap={gameModeMap}
        platformId={platformId}
        // arenaAugmentData is not needed for ClassicMatchDetails
      />
    );
  }
}
