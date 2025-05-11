// app/profile/[region]/[riotId]/live/LiveGamePageClient.tsx
'use client';

import { useTRPC } from '@/trpc/client';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation'; // For search functionality in ProfileHeader

import type { AppRouter } from '@/trpc/routers/_app';
import type { DDragonDataBundle } from '@/types/ddragon';
import type { TRPCClientErrorLike } from '@trpc/client';
// CurrentGameInfo type will be used by LiveGameCard, which this component renders

// Import Child Components
import { ProfileHeader } from '../ProfileHeader'; // Path goes up one level
import { LiveGameCard } from './LiveGameCard'; 

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Search, ShieldAlert, UserX } from 'lucide-react';

interface LiveGamePageClientProps {
  region: string;
  gameName: string;
  tagLine: string;
  currentPatchVersion: string;
  initialDDragonData: DDragonDataBundle;
}

export function LiveGamePageClient({
  region,
  gameName,
  tagLine,
  currentPatchVersion,
  initialDDragonData
}: LiveGamePageClientProps) {

  const trpcClient = useTRPC();
  const router = useRouter(); // Used by ProfileHeader's search

  // Fetch base profile information (needed for ProfileHeader and PUUID for live game query)
  const profileQueryOptions = trpcClient.player.getProfileByRiotId.queryOptions(
    { gameName, tagLine, platformId: region },
    { 
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 15 * 60 * 1000,    // 15 minutes
      refetchOnWindowFocus: false, 
      retry: 1 
    }
  );
  const {
    data: profile,
    isLoading: isLoadingProfile,
    error: profileError,
    isError: isProfileError,
    refetch: refetchProfile, // For a manual refresh button if needed
  } = useQuery(profileQueryOptions);

  // Query for Live Game Data
  // This query is enabled only after the profile (and thus puuid) is successfully fetched.
  const liveGameQueryOptions = trpcClient.match.getCurrentGameInfo.queryOptions(
    { puuid: profile?.puuid ?? '', platformId: region }, // Pass puuid, will be empty string if profile is not loaded
  );
  const {
    data: liveGameData,
    isLoading: isLoadingLiveGame,
    error: liveGameError,
    // refetch: refetchLiveGame, // Can be used for a manual refresh button on the LiveGameCard
  } = useQuery({
    ...liveGameQueryOptions,
    enabled: !!profile?.puuid, // Only fetch if puuid is available
    staleTime: 30 * 1000,       // Data is considered fresh for 30 seconds
    refetchInterval: 30 * 1000, // Refetch every 30 seconds to keep it "live"
    refetchOnWindowFocus: true, // Refetch when the window/tab gains focus
  });

  const typedProfileError = profileError as TRPCClientErrorLike<AppRouter> | null;
  const typedLiveGameError = liveGameError as TRPCClientErrorLike<AppRouter> | null;

  // --- Loading State for Profile ---
  // Show a full-page loader until the basic profile information is available for the header
  if (isLoadingProfile) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[calc(100vh-150px)]"> {/* Adjusted height */}
          <Loader2 className="h-12 w-12 animate-spin text-purple-400" />
          <p className="mt-4 text-lg text-slate-300">Loading Profile for Live View...</p>
      </div>
    );
  }

  // --- Error State for Profile ---
  // If profile fetching fails, we can't really show much else.
  if (isProfileError || !profile) {
    const errorToDisplay = typedProfileError || (profile === null && !isLoadingProfile ? { message: "Profile data could not be loaded." } as TRPCClientErrorLike<AppRouter> : null);
    const isNotFoundError = typedProfileError?.data?.code === 'NOT_FOUND';
    
    // Render ProfileHeader even on error to maintain page structure, passing the error
    return (
      <>
        <ProfileHeader
            profile={profile} // Can be null if initial load failed but before error state
            gameName={gameName}
            tagLine={tagLine}
            region={region}
            currentPatchVersion={currentPatchVersion}
            profileError={errorToDisplay} // Display the profile error in the header
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
              <Button onClick={() => refetchProfile()} variant="outline" size="sm" className="mt-3 border-red-500 text-red-400 hover:bg-red-500/10 hover:text-red-300">
                 <RefreshCw className="mr-1 h-3 w-3"/> Try Again
              </Button>
            </Alert>
          )}
        </div>
      </>
    );
  }
  
  // --- Main Render Logic (Profile Loaded) ---
  // Profile is loaded, now display header and the LiveGameCard which handles its own loading/error/data states for the live game.
  return (
    <div className="w-full">
        <ProfileHeader
            profile={profile} // Profile data is available here
            gameName={gameName}
            tagLine={tagLine}
            region={region}
            currentPatchVersion={currentPatchVersion}
            profileError={null} // No profile error at this stage if we reached here
            // activeTab and setActiveTab are not needed by ProfileHeader anymore
        />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* LiveGameCard will show its own loading spinner while liveGameData is fetching */}
          <LiveGameCard
            liveGameData={liveGameData} // This can be undefined while loading, or null if not in game
            isLoading={isLoadingLiveGame && !liveGameData} // Show loading if fetching and no data yet
            error={typedLiveGameError}
            searchedPlayerPuuid={profile.puuid} // PUUID is guaranteed to be here
            currentPatchVersion={currentPatchVersion}
            ddragonData={initialDDragonData}
          />
        </div>
    </div>
  );
}
