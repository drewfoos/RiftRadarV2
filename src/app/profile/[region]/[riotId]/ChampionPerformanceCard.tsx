// app/profile/[region]/[riotId]/ChampionPerformanceCard.tsx
'use client';

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Swords } from 'lucide-react';
import type { ChampionPerformanceStat } from './UserProfilePageClient'; // Assuming type is defined/exported there or move to shared types
import { calculateWinRate, formatKDA, getChampionIconUrl } from './utils'; // Assuming helpers moved to utils

interface ChampionPerformanceCardProps {
    stats: ChampionPerformanceStat[];
    isLoading: boolean;
    loadedMatchCount: number;
    currentPatchVersion: string;
}

export function ChampionPerformanceCard({ stats, isLoading, loadedMatchCount, currentPatchVersion }: ChampionPerformanceCardProps) {
    return (
        <Card className="bg-slate-800/60 border border-slate-700/50 shadow-sm">
            <CardHeader className="pb-3 pt-4 px-4">
                <CardTitle className="text-base font-semibold flex items-center gap-1.5 text-gray-100">
                    <Swords className="h-4 w-4"/>Champion Performance
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                    Based on last {loadedMatchCount} loaded matches
                </CardDescription>
            </CardHeader>
            <CardContent className="px-3 pb-3 space-y-2">
                {isLoading && <div className="flex justify-center p-1"><Loader2 className="h-4 w-4 animate-spin text-slate-400"/></div>}
                {!isLoading && stats.length === 0 && <p className="text-xs text-slate-400 italic">Not enough match data loaded.</p>}
                {!isLoading && stats.map(champ => (
                    <div key={champ.championId} className="flex items-center gap-2 p-1.5 rounded-md bg-slate-700/40 text-xs">
                        <Avatar className="h-8 w-8 rounded-sm shrink-0">
                            <AvatarImage src={getChampionIconUrl(champ.championNameId, currentPatchVersion)} alt={champ.championName} />
                            <AvatarFallback>{champ.championName?.[0]}</AvatarFallback>
                        </Avatar>
                        <div className="flex-grow min-w-0">
                            <p className="font-medium text-slate-200 truncate" title={champ.championName}>{champ.championName}</p>
                            <p className="text-slate-300">{formatKDA(champ.kills/champ.games, champ.deaths/champ.games, champ.assists/champ.games)}</p>
                        </div>
                        <div className="text-right shrink-0">
                            <p className={`font-semibold ${calculateWinRate(champ.wins, champ.losses) >= 50 ? 'text-green-400' : 'text-red-400'}`}>{calculateWinRate(champ.wins, champ.losses)}% WR</p>
                            <p className="text-slate-400">{champ.games} Game{champ.games > 1 ? 's' : ''}</p>
                        </div>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}

// NOTE: Assumes ChampionPerformanceStat type and helper functions (getChampionIconUrl, formatKDA, calculateWinRate)
// are either defined here, imported from UserProfilePageClient, or moved to a shared utils file.
