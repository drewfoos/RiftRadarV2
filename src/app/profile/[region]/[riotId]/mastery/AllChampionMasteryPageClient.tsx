// app/profile/[region]/[riotId]/mastery/AllChampionMasteryPageClient.tsx
'use client';

import { useTRPC } from '@/trpc/client';
// Import useQuery directly from @tanstack/react-query
import { useQuery as useTanStackQuery } from '@tanstack/react-query'; 
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';

import type { AppRouter } from '@/trpc/routers/_app'; // Ensure AppRouter is correctly typed and imported
import type { ChampionMasteryDTO, DDragonChampion } from '@/types/ddragon';
import type { TRPCClientErrorLike } from '@trpc/client';

// Import Child Components & UI
import { ProfileHeader } from '../ProfileHeader'; 
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Crown, Loader2, Search, ShieldAlert, Star, UserX } from 'lucide-react';
import Image from 'next/image';

// Assuming these utils are in a shared location or defined in a similar manner
function getChampionIconUrl(championNameId: string | undefined, patchVersion: string | undefined): string {
    if (!patchVersion || !championNameId) return "https://placehold.co/48x48/1F2937/4A5563?text=C";
    return `https://ddragon.leagueoflegends.com/cdn/${patchVersion}/img/champion/${championNameId}.png`;
}

function formatMasteryPoints(points: number): string {
    if (points >= 1000000) {
        return (points / 1000000).toFixed(1) + 'M';
    } else if (points >= 1000) {
        return (points / 1000).toFixed(1) + 'k';
    }
    return points.toString();
}

interface ProcessedMastery extends ChampionMasteryDTO {
    championName: string;
    championNameId?: string;
}

interface AllChampionMasteryPageClientProps {
  region: string;
  gameName: string;
  tagLine: string;
}

export function AllChampionMasteryPageClient({
  region,
  gameName,
  tagLine,
}: AllChampionMasteryPageClientProps) {

  const trpc = useTRPC(); // Renamed from trpcClient for clarity, it's the tRPC context hook's return
  const router = useRouter();

  // 1. Fetch DDragon Data Bundle using queryOptions
  // The input for getDDragonBundle is void/undefined, so pass undefined as the first argument.
  const ddragonBundleOptions = trpc.player.getDDragonBundle.queryOptions(undefined, {
    staleTime: Infinity, 
    gcTime: 24 * 60 * 60 * 1000, 
    refetchOnWindowFocus: false,
  });
  const ddragonBundleQuery = useTanStackQuery(ddragonBundleOptions);

  const initialDDragonData = ddragonBundleQuery.data;
  const currentPatchVersion = ddragonBundleQuery.data?.version;

  // 2. Fetch base profile information (needed for PUUID)
  const profileOptions = trpc.player.getProfileByRiotId.queryOptions(
    { gameName, tagLine, platformId: region },
    { 
      staleTime: 5 * 60 * 1000, 
      gcTime: 15 * 60 * 1000,   
      refetchOnWindowFocus: false, 
      retry: 1 
    }
  );
  const {
    data: profile,
    isLoading: isLoadingProfile,
    error: profileError,
    isError: isProfileError,
  } = useTanStackQuery(profileOptions);

  // 3. Fetch all champion mastery data
  const masteryOptions = trpc.player.getChampionMastery.queryOptions(
      { puuid: profile?.puuid ?? '', platformId: region },
      { 
        enabled: !!profile?.puuid && !!initialDDragonData && !!currentPatchVersion,
        staleTime: 5 * 60 * 1000, 
        gcTime: 15 * 60 * 1000,
        refetchOnWindowFocus: false 
      }
  );
  const { 
    data: allChampionMastery, 
    isLoading: isLoadingMasteryInitial, 
    error: masteryError 
  } = useTanStackQuery(masteryOptions);

  // 4. Process mastery data
  const processedMasteries = useMemo((): ProcessedMastery[] => {
    if (!allChampionMastery || !initialDDragonData?.championData || !currentPatchVersion) return [];
    return [...allChampionMastery]
        .sort((a, b) => b.championPoints - a.championPoints)
        .map(mastery => {
            const championDetails = Object.values(initialDDragonData.championData as Record<string, DDragonChampion>)
                .find(champ => champ.key === String(mastery.championId));
            return {
                ...mastery,
                championName: championDetails?.name || `ID: ${mastery.championId}`,
                championNameId: championDetails?.id,
            };
        });
  }, [allChampionMastery, initialDDragonData?.championData, currentPatchVersion]);

  const typedProfileError = profileError as TRPCClientErrorLike<AppRouter> | null;
  const typedMasteryError = masteryError as TRPCClientErrorLike<AppRouter> | null;
  const typedDDragonError = ddragonBundleQuery.error as TRPCClientErrorLike<AppRouter> | null;

  const isOverallLoading = isLoadingProfile || ddragonBundleQuery.isLoading;
  const isMasteryDataLoading = !!profile && !!initialDDragonData && isLoadingMasteryInitial;

  if (isOverallLoading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[calc(100vh-150px)]">
          <Loader2 className="h-12 w-12 animate-spin text-purple-400" />
          <p className="mt-4 text-lg text-slate-300">Loading Essential Data...</p>
      </div>
    );
  }

  if (isProfileError || !profile) {
    const errorToDisplay = typedProfileError || (profile === null && !isLoadingProfile ? { message: "Profile data could not be loaded." } as TRPCClientErrorLike<AppRouter> : null);
    const isNotFoundError = typedProfileError?.data?.code === 'NOT_FOUND';
    return (
      <>
        <ProfileHeader
            profile={profile} 
            gameName={gameName}
            tagLine={tagLine}
            region={region}
            currentPatchVersion={currentPatchVersion || "N/A"}
            profileError={errorToDisplay}
        />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center">
          {isNotFoundError ? (
            <>
              <UserX className="h-20 w-20 text-purple-400 mb-6 mx-auto" />
              <h2 className="text-3xl font-bold mb-3 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">Player Not Found</h2>
              <p className="text-gray-300 max-w-md mb-8 mx-auto">
                We couldn&apos;t find a player with the Riot ID <strong className="text-white">{gameName}#{tagLine}</strong> on the <strong className="text-white">{region.toUpperCase()}</strong> server.
              </p>
              <Button onClick={() => router.push('/')} variant="outline" className="dark:text-slate-200 dark:border-purple-500/50 dark:hover:bg-purple-700/20 dark:bg-gray-800/80">
                <Search className="mr-2 h-4 w-4" /> Search Again
              </Button>
            </>
          ) : (
            <Alert variant="destructive" className="max-w-lg mx-auto">
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>Error Fetching Profile Data</AlertTitle>
              <AlertDescription>
                An unexpected error occurred. 
                {errorToDisplay?.message && <span className="block mt-1 text-xs">Details: {errorToDisplay.message}</span>}
              </AlertDescription>
            </Alert>
          )}
        </div>
      </>
    );
  }
  
  if (ddragonBundleQuery.isError || !initialDDragonData || !currentPatchVersion) {
     return (
      <>
        <ProfileHeader
            profile={profile} 
            gameName={gameName}
            tagLine={tagLine}
            region={region}
            currentPatchVersion={"Error"}
            profileError={null}
        />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center">
            <Alert variant="destructive" className="max-w-lg mx-auto">
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>Error Fetching Game Data</AlertTitle>
              <AlertDescription>
                Could not load essential game data (like champion details or patch version). Please try refreshing the page.
                {typedDDragonError?.message && <span className="block mt-1 text-xs">Details: {typedDDragonError.message}</span>}
              </AlertDescription>
            </Alert>
        </div>
      </>
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
            profileError={null}
        />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <Card className="bg-slate-800/60 border border-slate-700/50 shadow-lg">
                <CardHeader>
                    <CardTitle className="text-2xl font-semibold flex items-center gap-2 text-gray-100">
                        <Crown className="h-6 w-6 text-yellow-500" /> All Champion Mastery
                    </CardTitle>
                    {isMasteryDataLoading && <CardDescription className="text-sm text-slate-400 mt-1">Loading all champion mastery...</CardDescription>}
                    {typedMasteryError && (
                        <Alert variant="destructive" className="mt-3 text-sm p-3">
                            <ShieldAlert className="h-5 w-5" />
                            <AlertTitle className="text-sm font-medium">Mastery Data Error</AlertTitle>
                            <AlertDescription>{typedMasteryError.message}</AlertDescription>
                        </Alert>
                    )}
                </CardHeader>

                {!isMasteryDataLoading && !typedMasteryError && processedMasteries.length > 0 && (
                    <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 p-4">
                        {processedMasteries.map((mastery) => (
                            <TooltipProvider key={mastery.championId} delayDuration={100}>
                                <Tooltip>
                                    <TooltipTrigger>
                                        <div className="flex flex-col items-center p-3 rounded-lg bg-slate-700/50 hover:bg-slate-700/80 transition-colors cursor-default shadow-md hover:shadow-purple-500/30">
                                            <Image
                                                src={getChampionIconUrl(mastery.championNameId, currentPatchVersion)}
                                                alt={mastery.championName || 'Champion Icon'}
                                                width={60} 
                                                height={60} 
                                                className="rounded-lg mb-2 border-2 border-slate-600"
                                                loading="lazy"
                                            />
                                            <p className="text-base font-semibold text-slate-50 truncate max-w-[120px] text-center">{mastery.championName}</p>
                                            <div className="flex items-center gap-1 mt-1">
                                                <Star className="h-4 w-4 text-yellow-400" />
                                                <span className="text-sm font-medium text-slate-200">Lvl {mastery.championLevel}</span>
                                            </div>
                                            <p className="text-xs text-slate-300 mt-0.5">{formatMasteryPoints(mastery.championPoints)} pts</p>
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent className="bg-slate-900 text-white border-slate-700 text-xs p-2 rounded-md shadow-xl">
                                        <p>Level: {mastery.championLevel}</p>
                                        <p>Points: {mastery.championPoints.toLocaleString()}</p>
                                        {mastery.championLevel < 7 && mastery.championPointsUntilNextLevel > 0 && (
                                            <p>Next Level: {mastery.championPointsUntilNextLevel.toLocaleString()} pts</p>
                                        )}
                                        <p>Last Played: {new Date(mastery.lastPlayTime).toLocaleDateString()}</p>
                                        <p>Chest Granted: {mastery.chestGranted ? 'Yes' : 'No'}</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        ))}
                    </CardContent>
                )}
                {!isMasteryDataLoading && !typedMasteryError && processedMasteries.length === 0 && (
                    <CardContent>
                        <p className="text-slate-400 text-sm italic text-center py-4">No champion mastery data found for this player.</p>
                    </CardContent>
                )}
                 {isMasteryDataLoading && ( 
                    <CardContent className="flex justify-center items-center py-10">
                        <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
                        <p className="ml-3 text-slate-300">Loading mastery data...</p>
                    </CardContent>
                )}
            </Card>
        </div>
    </div>
  );
}
