// app/profile/[region]/[riotId]/UserProfilePageClient.tsx
'use client';

import { useTRPC } from '@/trpc/client';
import { useInfiniteQuery, useQueries, useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useCallback } from 'react';

import type { AppRouter } from '@/trpc/routers/_app';
import type {
  DDragonChampion,
  DDragonDataBundle,
  LeagueEntryDTO,
  MatchDetailsData
} from '@/types/ddragon';
import type { TRPCClientErrorLike } from '@trpc/client';

// Import Child Components
import { ChampionMasterySection } from './ChampionMasterySection';
import { ChampionPerformanceCard } from './ChampionPerformanceCard';
import { MatchHistorySection } from './MatchHistorySection';
import { PlayedWithCard } from './PlayedWithCard';
import { ProfileHeader } from './ProfileHeader';
import { RankedStatsCard } from './RankedStatsCard';

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from '@/components/ui/button';
import { Info, Loader2, RefreshCw, Search, ShieldAlert, UserX, AlertCircle } from 'lucide-react';

// --- Constants ---
const DEFAULT_MATCH_COUNT_PER_PAGE = 10;
const MAX_MATCHES_FOR_STATS = 20;

const QUEUE_FILTERS = {
    ALL: { label: "All Matches", queueId: undefined, type: undefined },
    RANKED_SOLO: { label: "Ranked Solo/Duo", queueId: 420, type: 'ranked' },
    RANKED_FLEX: { label: "Ranked Flex", queueId: 440, type: 'ranked' },
    NORMAL_DRAFT: { label: "Normal Draft", queueId: 400, type: 'normal' },
    NORMAL_BLIND: { label: "Normal Blind", queueId: 430, type: 'normal' },
    ARAM: { label: "ARAM", queueId: 450, type: undefined },
    ARENA: { label: "Arena", queueId: 1700, type: undefined },
} as const;
type QueueFilterKey = keyof typeof QUEUE_FILTERS;
type MatchFilterType = typeof QUEUE_FILTERS[QueueFilterKey]['type'];

export interface ChampionPerformanceStat { championId: number; championName: string; championNameId?: string; games: number; wins: number; losses: number; kills: number; deaths: number; assists: number; }
export interface PlayedWithStat { puuid: string; gameName: string; tagLine: string; games: number; wins: number; profileIcon: number | null; }

interface MatchDetailError {
  matchId: string;
  error: TRPCClientErrorLike<AppRouter>;
}

interface UserProfilePageClientProps {
 region: string;
 gameName: string;
 tagLine: string;
 currentPatchVersion: string;
 initialDDragonData: DDragonDataBundle;
}

export function UserProfilePageClient({
 region,
 gameName,
 tagLine,
 currentPatchVersion,
 initialDDragonData
}: UserProfilePageClientProps) {

  // console.log(`[${COMPONENT_NAME_PROFILE_CLIENT}] Initializing with props:`, { region, gameName, tagLine, currentPatchVersion, ddragonDataLoaded: !!initialDDragonData });

  const trpcClient = useTRPC();
  const router = useRouter();

  const [selectedQueueFilterKey, setSelectedQueueFilterKey] = useState<QueueFilterKey>('ALL');
  const currentQueueFilter = QUEUE_FILTERS[selectedQueueFilterKey];

  const [matchDetailFetchErrors, setMatchDetailFetchErrors] = useState<MatchDetailError[]>([]);

  // --- Data Fetching Hooks ---
  const profileQueryOptions = trpcClient.player.getProfileByRiotId.queryOptions(
    { gameName, tagLine, platformId: region },
    { staleTime: 5 * 60 * 1000, gcTime: 15 * 60 * 1000, refetchOnWindowFocus: false, retry: 1 }
  );
  const {
    data: profile,
    isLoading: isLoadingProfile,
    error: profileError,
    isError: isProfileError,
    refetch: refetchProfile,
  } = useQuery(profileQueryOptions);

  // --- useEffect Hooks ---
  useEffect(() => {
    if (profile) {
      // console.debug(`[${COMPONENT_NAME_PROFILE_CLIENT}] Profile data loaded/updated:`, { puuid: profile.puuid, name: profile.name, summonerLevel: profile.summonerLevel });
    }
    if (isProfileError) {
      // console.error(`[${COMPONENT_NAME_PROFILE_CLIENT}] Error fetching profile:`, profileError);
    }
  }, [profile, isProfileError, profileError]);

  // useEffect to reset match detail errors ONLY when the queue filter changes.
  // Assuming gameName, tagLine, region define the "session" for this profile page.
  // If the user navigates to a different profile, the component unmounts and state is naturally reset.
  useEffect(() => {
    // console.log(`[${COMPONENT_NAME_PROFILE_CLIENT}] Queue filter changed to: ${selectedQueueFilterKey}. Resetting match detail errors.`);
    setMatchDetailFetchErrors([]);
  }, [selectedQueueFilterKey]); // Only reset when the filter explicitly changes by user action.

  // useEffect to log the state of matchDetailFetchErrors when it changes
  useEffect(() => {
    // console.log(`[${COMPONENT_NAME_PROFILE_CLIENT}] matchDetailFetchErrors state is now:`, matchDetailFetchErrors.length, matchDetailFetchErrors.map(e => e.matchId));
  }, [matchDetailFetchErrors]);


  const handleMatchDetailError = useCallback((matchId: string, error: TRPCClientErrorLike<AppRouter>) => {
    // console.log(`[${COMPONENT_NAME_PROFILE_CLIENT}] handleMatchDetailError called for matchId: ${matchId}`);
    setMatchDetailFetchErrors(prevErrors => {
      if (!prevErrors.some(e => e.matchId === matchId)) {
        return [...prevErrors, { matchId, error }];
      }
      return prevErrors;
    });
  }, []);


  const rankedQueryOptions = trpcClient.player.getRankedEntries.queryOptions(
    { summonerId: profile?.id ?? '', platformId: region },
    { enabled: !!profile?.id, staleTime: 10 * 60 * 1000, gcTime: 30 * 60 * 1000, refetchOnWindowFocus: false }
  );
  const { data: rankedEntries, isLoading: isLoadingRanked, error: rankedError } = useQuery(rankedQueryOptions);

  const masteryQueryOptions = trpcClient.player.getChampionMastery.queryOptions(
      { puuid: profile?.puuid ?? '', platformId: region },
      { enabled: !!profile?.puuid, staleTime: 30 * 60 * 1000, gcTime: 60 * 60 * 1000, refetchOnWindowFocus: false }
  );
  const { data: championMastery, isLoading: isLoadingMastery, error: masteryError } = useQuery(masteryQueryOptions);
  
  const matchIdsInfiniteQueryBaseOptions = trpcClient.match.getMatchIdsByPuuid.infiniteQueryOptions(
    { puuid: profile?.puuid ?? '', platformId: region, limit: DEFAULT_MATCH_COUNT_PER_PAGE, queue: currentQueueFilter.queueId, type: currentQueueFilter.type as MatchFilterType },
  );
  const {
    data: matchPages,
    fetchNextPage, hasNextPage, isFetchingNextPage,
    isLoading: isLoadingMatchIdsInitial, isFetching: isFetchingMatchIds, error: matchIdsError,
    refetch: refetchMatchIdsPages,
  } = useInfiniteQuery({
      ...matchIdsInfiniteQueryBaseOptions,
      enabled: !!profile?.puuid,
      staleTime: 5 * 60 * 1000,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      initialPageParam: 0,
  });

  const allMatchIds = useMemo(() => {
    const ids = matchPages?.pages.flatMap((page) => page.items) ?? [];
    return ids.filter(id => typeof id === 'string' && id.trim() !== '');
  }, [matchPages]);

  const matchIdsForStats = useMemo(() => {
    const ids = allMatchIds.slice(0, MAX_MATCHES_FOR_STATS);
    return ids;
  }, [allMatchIds]);
  
  const matchDetailsQueriesForStats = useQueries({
      queries: matchIdsForStats.map((matchId) =>
          trpcClient.match.getMatchDetails.queryOptions(
              { matchId, platformId: region },
              { staleTime: Infinity, gcTime: 24 * 60 * 60 * 1000, enabled: !!matchId && !!profile?.puuid, retry: 1 }
          )
      ),
  });

  const isLoadingMatchDetailsForStats = useMemo(() => {
    return matchDetailsQueriesForStats.some(q => q.isLoading);
  }, [matchDetailsQueriesForStats]);

  const loadedMatchDetailsForStats = useMemo(() => {
    const details = matchDetailsQueriesForStats.filter(q => q.isSuccess && q.data).map(q => q.data as MatchDetailsData);
    return details;
  }, [matchDetailsQueriesForStats]);

  const soloRank = useMemo(() => rankedEntries?.find((entry: LeagueEntryDTO) => entry.queueType === 'RANKED_SOLO_5x5'), [rankedEntries]);
  const flexRank = useMemo(() => rankedEntries?.find((entry: LeagueEntryDTO) => entry.queueType === 'RANKED_FLEX_SR'), [rankedEntries]);
  
  const topMasteryChampions = useMemo(() => {
      if (!championMastery || !initialDDragonData.championData) {
        return [];
      }
      const processed = [...championMastery]
          .sort((a, b) => b.championPoints - a.championPoints)
          .slice(0, 5)
          .map(mastery => {
              const championDetails = Object.values(initialDDragonData.championData as Record<string, DDragonChampion>)
                  .find(champ => champ.key === String(mastery.championId));
              return {
                  ...mastery,
                  championName: championDetails?.name || `ID: ${mastery.championId}`,
                  championNameId: championDetails?.id,
              };
          });
      return processed;
  }, [championMastery, initialDDragonData.championData]);

  const championStats = useMemo((): ChampionPerformanceStat[] => {
    if (!profile?.puuid || loadedMatchDetailsForStats.length === 0 || !initialDDragonData.championData) {
        return [];
    }
    const stats: Record<number, ChampionPerformanceStat> = {};
    for (const match of loadedMatchDetailsForStats) {
      if (!match?.info?.participants) {
        continue;
      }
      const playerPerf = match.info.participants.find(p => p.puuid === profile.puuid);
      if (!playerPerf) continue;
      const champId = playerPerf.championId;
      if (!stats[champId]) {
        const championDetails = initialDDragonData.championData ? Object.values(initialDDragonData.championData).find(c => c.key === String(champId)) : undefined;
        stats[champId] = { championId: champId, championName: playerPerf.championName || championDetails?.name || `ID: ${champId}`, championNameId: championDetails?.id, games: 0, wins: 0, losses: 0, kills: 0, deaths: 0, assists: 0 };
      }
      stats[champId].games += 1;
      if (playerPerf.win) stats[champId].wins += 1; else stats[champId].losses += 1;
      stats[champId].kills += playerPerf.kills;
      stats[champId].deaths += playerPerf.deaths;
      stats[champId].assists += playerPerf.assists;
    }
    return Object.values(stats).sort((a, b) => b.games - a.games).slice(0, 5);
  }, [loadedMatchDetailsForStats, profile?.puuid, initialDDragonData.championData]);

  const playedWithStats = useMemo((): PlayedWithStat[] => {
    if (!profile?.puuid || loadedMatchDetailsForStats.length === 0) {
        return [];
    }
    const teammates: Record<string, PlayedWithStat> = {};
    for (const match of loadedMatchDetailsForStats) {
      if (!match?.info?.participants) {
        continue;
      }
      const playerPerf = match.info.participants.find(p => p.puuid === profile.puuid);
      if (!playerPerf) continue;
      const playerTeamId = playerPerf.teamId;
      const currentTeammates = match.info.participants.filter(p => 
        p.teamId === playerTeamId && p.puuid !== profile.puuid
      );
      for (const teammate of currentTeammates) {
        if (!teammates[teammate.puuid]) {
          teammates[teammate.puuid] = {
            puuid: teammate.puuid,
            gameName: teammate.riotIdGameName || teammate.summonerName.split('#')[0] || 'Unknown',
            tagLine: teammate.riotIdTagline || teammate.summonerName.split('#')[1] || 'TAG',
            games: 0, 
            wins: 0,
            profileIcon: teammate.profileIcon !== undefined ? Number(teammate.profileIcon) : null
          };
        }
        teammates[teammate.puuid].games += 1;
        if (playerPerf.win) {
          teammates[teammate.puuid].wins += 1;
        }
        if (teammates[teammate.puuid].profileIcon === null && teammate.profileIcon !== undefined) {
          teammates[teammate.puuid].profileIcon = Number(teammate.profileIcon);
        }
      }
    }
    return Object.values(teammates)
      .filter(t => t.games >= 2)
      .sort((a, b) => b.games - a.games)
      .slice(0, 5);
  }, [loadedMatchDetailsForStats, profile?.puuid]);

  const typedProfileError = profileError as TRPCClientErrorLike<AppRouter> | null;
  const typedRankedError = rankedError as TRPCClientErrorLike<AppRouter> | null;
  const typedMasteryError = masteryError as TRPCClientErrorLike<AppRouter> | null;
  const typedMatchIdsError = matchIdsError as TRPCClientErrorLike<AppRouter> | null;

  const handleFilterSelect = (newFilterKey: string) => {
      if (newFilterKey in QUEUE_FILTERS) {
          setSelectedQueueFilterKey(newFilterKey as QueueFilterKey);
          refetchMatchIdsPages(); 
      }
  };

  if (isLoadingProfile) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-10rem)]">
        <div className="flex flex-col items-center gap-4 p-8 rounded-lg bg-slate-800/50">
            <Loader2 className="h-12 w-12 animate-spin text-blue-400" />
            <p className="text-lg text-slate-300">Loading profile for {gameName}#{tagLine}...</p>
        </div>
      </div>
    );
  }

  if (isProfileError) {
    if (typedProfileError?.data?.code === 'NOT_FOUND') {
      return (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] text-center p-4">
            <UserX className="h-20 w-20 text-purple-400 mb-6" />
            <h2 className="text-3xl font-bold mb-3 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500"> Player Not Found </h2>
            <p className="text-gray-300 max-w-md mb-8"> We couldn&apos;t find a player with the Riot ID <strong className="text-white">{gameName}#{tagLine}</strong> on the <strong className="text-white">{region.toUpperCase()}</strong> server. Please double-check the spelling, tag, and selected region. </p>
            <Button onClick={() => router.push('/')} variant="outline" className="dark:text-slate-200 dark:border-purple-500/50 dark:hover:bg-purple-700/20 dark:bg-gray-800/80"> <Search className="mr-2 h-4 w-4" /> Search Again </Button>
        </div>
      );
    } else {
      return (
         <div className="flex justify-center items-center min-h-[calc(100vh-10rem)] p-4">
            <Alert variant="destructive" className="max-w-lg">
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>Error Fetching Profile</AlertTitle>
              <AlertDescription> An unexpected error occurred. Please try refreshing. {typedProfileError?.message && <span className="block mt-1 text-xs">Details: {typedProfileError.message}</span>} </AlertDescription>
                <Button onClick={() => refetchProfile()} variant="destructive" size="sm" className="mt-2"> <RefreshCw className="mr-1 h-3 w-3"/> Try Again </Button>
            </Alert>
          </div>
      );
    }
  }

  if (!profile) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] text-center p-4">
            <Info className="h-16 w-16 text-gray-500 mb-4" />
            <h2 className="text-2xl font-semibold mb-2 text-gray-100">Profile Data Unavailable</h2>
            <p className="text-gray-400 max-w-md mb-6"> Profile data for <span className="font-semibold text-white">{gameName}#{tagLine}</span> could not be loaded at this time. Please try again later. </p>
              <Button onClick={() => router.push('/')} variant="outline" className="dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-700"> <Search className="mr-2 h-4 w-4" /> Search Again </Button>
        </div>
      );
  }

  return (
    <div className="w-full">
        <ProfileHeader
            profile={profile}
            gameName={gameName}
            tagLine={tagLine}
            region={region}
            currentPatchVersion={currentPatchVersion}
            profileError={typedProfileError} 
        />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {matchDetailFetchErrors.length > 0 && (
              <Alert variant="destructive" className="mb-6 text-sm">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Match Data Issues</AlertTitle>
                <AlertDescription>
                  Having trouble loading full details for {matchDetailFetchErrors.length === 1 ? "1 game" : `${matchDetailFetchErrors.length} games`}. Some information may be missing.
                </AlertDescription>
              </Alert>
            )}

          <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
            <aside className="w-full lg:w-1/4 shrink-0 space-y-6">
              <RankedStatsCard
                  soloRank={soloRank}
                  flexRank={flexRank}
                  isLoading={isLoadingRanked}
                  error={typedRankedError}
              />
              <div className="hidden lg:block">
                <ChampionPerformanceCard
                    stats={championStats}
                    isLoading={isLoadingMatchDetailsForStats}
                    loadedMatchCount={loadedMatchDetailsForStats.length}
                    currentPatchVersion={currentPatchVersion}
                />
              </div>
              <PlayedWithCard
                  stats={playedWithStats}
                  isLoading={isLoadingMatchDetailsForStats}
                  loadedMatchCount={loadedMatchDetailsForStats.length}
                  currentPatchVersion={currentPatchVersion}
                  region={region}
              />
            </aside>
            <div className="w-full lg:w-3/4 space-y-8">
              <div className="hidden lg:block">
                <ChampionMasterySection
                    topMasteryChampions={topMasteryChampions}
                    isLoading={isLoadingMastery}
                    error={typedMasteryError}
                    currentPatchVersion={currentPatchVersion}
                />
              </div>
              <MatchHistorySection
                  allMatchIds={allMatchIds}
                  selectedQueueFilterKey={selectedQueueFilterKey}
                  handleFilterSelect={handleFilterSelect}
                  refetchMatchIdsPages={refetchMatchIdsPages}
                  fetchNextPage={fetchNextPage}
                  hasNextPage={hasNextPage}
                  isFetchingMatchIds={isFetchingMatchIds}
                  isFetchingNextPage={isFetchingNextPage}
                  isLoadingMatchIdsInitial={isLoadingMatchIdsInitial}
                  matchIdsError={typedMatchIdsError}
                  matchPages={matchPages}
                  region={region}
                  searchedPlayerPuuid={profile.puuid}
                  currentPatchVersion={currentPatchVersion}
                  initialDDragonData={initialDDragonData}
                  onMatchDetailError={handleMatchDetailError}
              />
            </div>
          </div>
        </div>
    </div>
  );
}
