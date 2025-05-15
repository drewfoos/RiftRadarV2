// app/profile/[region]/[riotId]/MatchHistorySection.tsx
'use client';

import { MatchDisplaySwitcher } from '@/app/MatchDisplaySwitcher'; // Adjust path if needed
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { DDragonDataBundle } from '@/types/ddragon';
import { ChevronsDown, Filter, Loader2, RefreshCw, ShieldAlert } from 'lucide-react';
// Import TRPC error type
import type { AppRouter } from '@/trpc/routers/_app'; // Adjust path if needed
import type { TRPCClientErrorLike } from '@trpc/client';
// Import type for matchPages data structure
import type { InfiniteData } from '@tanstack/react-query';
import { useMemo, useEffect } from 'react'; // Import useMemo and useEffect

// Re-define or import filter types/constants
const QUEUE_FILTERS = {
    ALL: { label: "All Matches", queueId: undefined, type: undefined },
    RANKED_SOLO: { label: "Ranked Solo/Duo", queueId: 420, type: 'ranked' },
    RANKED_FLEX: { label: "Ranked Flex", queueId: 440, type: 'ranked' },
    NORMAL_DRAFT: { label: "Normal Draft", queueId: 400, type: 'normal' },
    NORMAL_BLIND: { label: "Normal Blind", queueId: 430, type: 'normal' },
    ARAM: { label: "ARAM", queueId: 450, type: undefined },
    ARENA: { label: "Arena", queueId: 1700, type: undefined },
} as const; // Use 'as const' for stricter typing
type QueueFilterKey = keyof typeof QUEUE_FILTERS;

// Define the expected structure of a single page from the infinite query
interface MatchIdPage {
    items: string[]; // Expecting an array of strings
    nextCursor?: number | null | undefined;
}

interface MatchHistorySectionProps {
    allMatchIds: string[]; // Re-added to satisfy the prop being passed by UserProfilePageClient
    selectedQueueFilterKey: QueueFilterKey;
    handleFilterSelect: (key: string) => void;
    refetchMatchIdsPages: () => void;
    fetchNextPage: () => void;
    hasNextPage: boolean | undefined;
    isFetchingMatchIds: boolean;
    isFetchingNextPage: boolean;
    isLoadingMatchIdsInitial: boolean;
    matchIdsError: TRPCClientErrorLike<AppRouter> | null;
    matchPages: InfiniteData<MatchIdPage, number | null> | undefined;
    // Props needed by MatchDisplaySwitcher
    region: string;
    searchedPlayerPuuid: string;
    currentPatchVersion: string;
    initialDDragonData: DDragonDataBundle;
    // Callback prop from UserProfilePageClient, expected to be passed as onFetchError to MatchDisplaySwitcher
    onMatchDetailError?: (matchId: string, error: TRPCClientErrorLike<AppRouter>) => void;
}

export function MatchHistorySection({
    allMatchIds, // Destructure the prop, even if not directly used for mapping MatchDisplaySwitcher instances
    selectedQueueFilterKey,
    handleFilterSelect,
    refetchMatchIdsPages,
    fetchNextPage,
    hasNextPage,
    isFetchingMatchIds,
    isFetchingNextPage,
    isLoadingMatchIdsInitial,
    matchIdsError,
    matchPages,
    region,
    searchedPlayerPuuid,
    currentPatchVersion,
    initialDDragonData,
    onMatchDetailError // This is the prop received from UserProfilePageClient
}: MatchHistorySectionProps) {

    // Log to check if onMatchDetailError prop is received
    useEffect(() => {
        if (typeof onMatchDetailError === 'function') {
            console.log('[MatchHistorySection] Received onMatchDetailError prop successfully.');
        } else {
            console.warn('[MatchHistorySection] onMatchDetailError prop is UNDEFINED or NOT A FUNCTION.');
        }
    }, [onMatchDetailError]);

    // validDisplayedMatchIds is derived from matchPages and is used for rendering MatchDisplaySwitcher instances
    const validDisplayedMatchIds = useMemo(() => {
        const idsFromPages = matchPages?.pages.flatMap(page => page.items) ?? [];
        const validatedIds = idsFromPages.filter(id => {
            const isValid = typeof id === 'string' && id.trim() !== '';
            if (!isValid && id !== null && id !== undefined) {
                console.warn(`[MatchHistorySection] Invalid or empty matchId found in pages: '${id}', type: ${typeof id}. Filtering out.`);
            }
            return isValid;
        });
        // console.log('[MatchHistorySection] validDisplayedMatchIds:', validatedIds);
        // console.log('[MatchHistorySection] allMatchIds prop (for reference):', allMatchIds); // Log the received allMatchIds prop
        return validatedIds;
    }, [matchPages]);


    return (
        <section>
            {/* Match List Header/Refresh/Filter */}
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-100"> {QUEUE_FILTERS[selectedQueueFilterKey].label} </h2>
                <div className="flex items-center gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8 px-3 border-slate-600 bg-slate-800/60 hover:bg-slate-700/80 text-slate-300 hover:text-slate-100"> <Filter className="h-3.5 w-3.5 mr-1.5" /> Filter </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="bg-slate-800 border-slate-700 text-slate-200">
                            <DropdownMenuLabel>Filter by Queue</DropdownMenuLabel>
                            <DropdownMenuSeparator className="bg-slate-700"/>
                            {(Object.keys(QUEUE_FILTERS) as QueueFilterKey[]).map(key => (
                                <DropdownMenuItem
                                    key={key}
                                    onSelect={() => handleFilterSelect(key)}
                                    className={`cursor-pointer hover:!bg-slate-700 focus:!bg-slate-600 ${selectedQueueFilterKey === key ? 'bg-blue-700/50 text-white' : ''}`}
                                >
                                    {QUEUE_FILTERS[key].label}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <Button onClick={() => refetchMatchIdsPages()} variant="ghost" size="sm" disabled={isFetchingMatchIds} className="text-gray-300 hover:bg-slate-700/50 hover:text-white h-8 px-2">
                        <RefreshCw className={`h-4 w-4 ${isFetchingMatchIds && !isFetchingNextPage ? 'animate-spin' : ''}`} />
                        <span className="ml-1.5 hidden sm:inline">Refresh</span>
                    </Button>
                </div>
            </div>

            {isLoadingMatchIdsInitial && !matchPages && (
                <div className="flex items-center justify-center p-6 text-slate-400">
                    <Loader2 className="mr-2 h-6 w-6 animate-spin" />Loading match list...
                </div>
            )}

            {matchIdsError && (
                <Alert variant="destructive" className="mt-4">
                    <ShieldAlert className="h-4 w-4" />
                    <AlertTitle>Error Fetching Match List</AlertTitle>
                    <AlertDescription>{matchIdsError.message || "An unknown error occurred while fetching the match list."}</AlertDescription>
                </Alert>
            )}

            {!isLoadingMatchIdsInitial && validDisplayedMatchIds.length === 0 && !matchIdsError && (
                <p className="text-center text-gray-500 dark:text-gray-400 py-4">No recent matches found for this filter.</p>
            )}

            {validDisplayedMatchIds.length > 0 && (
                <div className="space-y-3">
                    {validDisplayedMatchIds.map((matchId: string) => ( // Mapping over validDisplayedMatchIds
                        <MatchDisplaySwitcher
                            key={`${selectedQueueFilterKey}-${matchId}`}
                            matchId={matchId}
                            platformId={region}
                            searchedPlayerPuuid={searchedPlayerPuuid}
                            currentPatchVersion={currentPatchVersion}
                            summonerSpellData={initialDDragonData.summonerSpellData ?? undefined}
                            runeTreeData={initialDDragonData.runeTreeData ?? undefined}
                            championData={initialDDragonData.championData ?? undefined}
                            gameModeMap={initialDDragonData.gameModeMap ?? undefined}
                            arenaAugmentData={initialDDragonData.arenaAugmentData ?? undefined}
                            onFetchError={onMatchDetailError}
                        />
                    ))}
                </div>
            )}

            {hasNextPage && (
                <div className="mt-6 flex justify-center">
                    <Button
                        onClick={() => fetchNextPage()}
                        disabled={isFetchingNextPage}
                        variant="outline"
                        className="border-slate-600 bg-slate-800/60 hover:bg-slate-700/80 text-slate-300 hover:text-slate-100"
                    >
                        {isFetchingNextPage ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <ChevronsDown className="mr-2 h-4 w-4" />
                        )}
                        Load More Matches
                    </Button>
                </div>
            )}
        </section>
    );
}
