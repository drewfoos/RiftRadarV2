// app/profile/[region]/[riotId]/ChampionMasterySection.tsx
'use client';

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
// Progress component is no longer used
// import { Progress } from "@/components/ui/progress"; 
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { ChampionMasteryDTO } from '@/types/ddragon';
import { Crown, ShieldAlert, Star } from 'lucide-react';
import type { AppRouter } from '@/trpc/routers/_app'; 
import type { TRPCClientErrorLike } from '@trpc/client';
import { formatMasteryPoints, getChampionIconUrl } from './utils'; 
import Image from 'next/image'; 

interface ProcessedMastery extends ChampionMasteryDTO {
    championName: string;
    championNameId?: string;
}

interface ChampionMasterySectionProps {
    topMasteryChampions: ProcessedMastery[];
    isLoading: boolean;
    error: TRPCClientErrorLike<AppRouter> | null;
    currentPatchVersion: string;
}

export function ChampionMasterySection({ topMasteryChampions, isLoading, error, currentPatchVersion }: ChampionMasterySectionProps) {
    return (
        <Card className="bg-slate-800/60 border border-slate-700/50 shadow-sm">
            <CardHeader>
                <CardTitle className="text-xl font-semibold flex items-center gap-2 text-gray-100">
                    <Crown className="h-5 w-5 text-yellow-500" /> Champion Mastery
                </CardTitle>
                {isLoading && <CardDescription className="text-xs text-slate-400">Loading mastery...</CardDescription>}
                {error && (
                    <Alert variant="destructive" className="mt-2 text-xs p-2">
                        <ShieldAlert className="h-4 w-4" />
                        <AlertTitle className="text-xs font-medium">Mastery Error</AlertTitle>
                        <AlertDescription>{error.message}</AlertDescription>
                    </Alert>
                )}
            </CardHeader>
            {!isLoading && !error && topMasteryChampions.length > 0 && (
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 p-4">
                    {topMasteryChampions.map((mastery) => (
                        <TooltipProvider key={mastery.championId} delayDuration={100}>
                            <Tooltip>
                                <TooltipTrigger>
                                    <div className="flex flex-col items-center p-3 rounded-lg bg-slate-700/50 hover:bg-slate-700/80 transition-colors cursor-default shadow">
                                        <Image
                                            src={getChampionIconUrl(mastery.championNameId, currentPatchVersion)}
                                            alt={mastery.championName || 'Champion Icon'}
                                            width={48} 
                                            height={48} 
                                            className="rounded-md mb-2 border-2 border-slate-600"
                                            loading="lazy"
                                        />
                                        <p className="text-sm font-medium text-slate-100 truncate max-w-[100px]">{mastery.championName}</p>
                                        <div className="flex items-center gap-1 mt-1">
                                            <Star className="h-4 w-4 text-yellow-400" />
                                            <span className="text-xs font-semibold text-slate-300">Lvl {mastery.championLevel}</span>
                                        </div>
                                        <p className="text-xs text-slate-400 mt-0.5">{formatMasteryPoints(mastery.championPoints)} pts</p>
                                        {/* Progress bar and its conditional rendering logic have been removed */}
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent className="bg-slate-900 text-white border-slate-700 text-xs p-2">
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
            {!isLoading && !error && topMasteryChampions.length === 0 && (
                <CardContent>
                    <p className="text-slate-400 text-sm italic text-center py-2">No champion mastery data found.</p>
                </CardContent>
            )}
        </Card>
    );
}
