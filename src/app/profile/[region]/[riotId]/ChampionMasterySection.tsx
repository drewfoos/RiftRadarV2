// app/profile/[region]/[riotId]/ChampionMasterySection.tsx
'use client';

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { ChampionMasteryDTO } from '@/types/ddragon';
import { Crown, ShieldAlert, Star } from 'lucide-react';
// *** Import TRPC error type ***
import type { AppRouter } from '@/trpc/routers/_app'; // Adjust path if needed
import type { TRPCClientErrorLike } from '@trpc/client';
// Import helpers from utils or define locally
import { formatMasteryPoints, getChampionIconUrl } from './utils'; // Assuming helpers moved to utils.tsx

// Define the structure for the processed mastery data needed by this component
interface ProcessedMastery extends ChampionMasteryDTO {
    championName: string;
    championNameId?: string;
}

interface ChampionMasterySectionProps {
    topMasteryChampions: ProcessedMastery[];
    isLoading: boolean;
    // *** Update error prop type ***
    error: TRPCClientErrorLike<AppRouter> | null;
    currentPatchVersion: string;
}

export function ChampionMasterySection({ topMasteryChampions, isLoading, error, currentPatchVersion }: ChampionMasterySectionProps) {
    return (
        // Apply consistent card styling
        <Card className="bg-slate-800/60 border border-slate-700/50 shadow-sm">
            <CardHeader>
                <CardTitle className="text-xl font-semibold flex items-center gap-2 text-gray-100">
                    <Crown className="h-5 w-5 text-yellow-500" /> Champion Mastery
                </CardTitle>
                {/* Loading and Error States */}
                {isLoading && <CardDescription className="text-xs text-slate-400">Loading mastery...</CardDescription>}
                {error && (
                    <Alert variant="destructive" className="mt-2 text-xs p-2">
                        <ShieldAlert className="h-4 w-4" />
                        <AlertTitle className="text-xs font-medium">Mastery Error</AlertTitle>
                        <AlertDescription>{error.message}</AlertDescription>
                    </Alert>
                )}
            </CardHeader>
            {/* Mastery Grid */}
            {!isLoading && !error && topMasteryChampions.length > 0 && (
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 p-4">
                    {topMasteryChampions.map((mastery) => (
                        <TooltipProvider key={mastery.championId} delayDuration={100}>
                            <Tooltip>
                                <TooltipTrigger>
                                    {/* Individual Mastery Item Card */}
                                    <div className="flex flex-col items-center p-3 rounded-lg bg-slate-700/50 hover:bg-slate-700/80 transition-colors cursor-default shadow">
                                        {/* Champion Icon */}
                                        <img
                                            src={getChampionIconUrl(mastery.championNameId, currentPatchVersion)}
                                            alt={mastery.championName}
                                            className="w-12 h-12 rounded-md mb-2 border-2 border-slate-600"
                                            loading="lazy" // Add lazy loading
                                            onError={(e) => { e.currentTarget.src = 'https://placehold.co/48x48/374151/9CA3AF?text=?'; }} // Fallback placeholder
                                        />
                                        {/* Champion Name */}
                                        <p className="text-sm font-medium text-slate-100 truncate max-w-[100px]">{mastery.championName}</p>
                                        {/* Mastery Level */}
                                        <div className="flex items-center gap-1 mt-1">
                                            <Star className="h-4 w-4 text-yellow-400" />
                                            <span className="text-xs font-semibold text-slate-300">Lvl {mastery.championLevel}</span>
                                        </div>
                                        {/* Mastery Points */}
                                        <p className="text-xs text-slate-400 mt-0.5">{formatMasteryPoints(mastery.championPoints)} pts</p>
                                        {/* Progress to next level (if applicable) */}
                                        {mastery.championLevel < 7 && mastery.championPointsUntilNextLevel > 0 && (
                                            <Progress
                                                value={(mastery.championPointsSinceLastLevel / (mastery.championPointsSinceLastLevel + mastery.championPointsUntilNextLevel)) * 100}
                                                className="h-1 mt-2 w-full bg-slate-600 [&>*]:bg-yellow-500" // Style indicator via child selector
                                                aria-label={`Progress to Mastery Level ${mastery.championLevel + 1}`}
                                            />
                                        )}
                                    </div>
                                </TooltipTrigger>
                                {/* Tooltip Content */}
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
            {/* No Mastery Data State */}
            {!isLoading && !error && topMasteryChampions.length === 0 && (
                <CardContent>
                    <p className="text-slate-400 text-sm italic text-center py-2">No champion mastery data found.</p>
                </CardContent>
            )}
        </Card>
    );
}
// NOTE: Assumes helper functions getChampionIconUrl and formatMasteryPoints are defined/imported from utils.tsx
