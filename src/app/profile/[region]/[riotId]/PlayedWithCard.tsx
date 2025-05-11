// app/profile/[region]/[riotId]/PlayedWithCard.tsx
'use client';

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Users } from 'lucide-react';
import Link from 'next/link';
import type { PlayedWithStat } from './UserProfilePageClient';
import { calculateWinRate } from './utils';

// Define constants
const DDRAGON_BASE_URL = "https://ddragon.leagueoflegends.com/cdn";

interface PlayedWithCardProps {
    stats: PlayedWithStat[];
    isLoading: boolean;
    loadedMatchCount: number;
    currentPatchVersion: string;
    region: string;
}

// Helper function to get profile icon URL
function getProfileIconUrl(iconId: number | null | undefined, patchVersion: string): string {
    if (!iconId || !patchVersion) {
        return "https://placehold.co/24x24/1f2937/374151?text=?";
    }
    return `${DDRAGON_BASE_URL}/${patchVersion}/img/profileicon/${iconId}.png`;
}

export function PlayedWithCard({ stats, isLoading, loadedMatchCount, currentPatchVersion, region }: PlayedWithCardProps) {
    return (
        <Card className="bg-slate-800/60 border border-slate-700/50 shadow-sm">
            <CardHeader className="pb-3 pt-4 px-4">
                <CardTitle className="text-base font-semibold flex items-center gap-1.5 text-gray-100">
                    <Users className="h-4 w-4"/>Frequently Played With
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                    Based on last {loadedMatchCount} loaded matches (min. 2 games)
                </CardDescription>
            </CardHeader>
            <CardContent className="px-3 pb-3 space-y-2">
                 {isLoading && <div className="flex justify-center p-1"><Loader2 className="h-4 w-4 animate-spin text-slate-400"/></div>}
                 {!isLoading && stats.length === 0 && <p className="text-xs text-slate-400 italic">Not enough match data loaded or no frequent teammates found.</p>}
                 {!isLoading && stats.map((player) => {
                    // Construct the URL for navigation
                    const combinedRiotId = `${player.gameName}-${player.tagLine}`;
                    const profilePath = `/profile/${encodeURIComponent(region)}/${encodeURIComponent(combinedRiotId)}`;

                    return (
                         <div key={player.puuid} className="flex items-center justify-between gap-2 p-1.5 rounded-md bg-slate-700/40 text-xs hover:bg-slate-700/60 transition-colors">
                             <Link href={profilePath} className="flex items-center gap-2 min-w-0 hover:opacity-80 transition-opacity" title={`View profile for ${player.gameName}#${player.tagLine}`}>
                                <Avatar className="h-6 w-6 rounded-sm shrink-0 border border-slate-600/50">
                                    <AvatarImage 
                                        src={getProfileIconUrl(player.profileIcon, currentPatchVersion)} 
                                        alt=""
                                    />
                                    <AvatarFallback className="text-[10px] bg-slate-600 text-slate-300">
                                        {player.gameName.charAt(0).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                <span className="font-medium text-slate-200 truncate">
                                    {player.gameName}<span className="text-slate-500">#{player.tagLine}</span>
                                </span>
                             </Link>
                             <div className="text-right shrink-0">
                                 <p className={`font-semibold ${calculateWinRate(player.wins, player.games - player.wins) >= 50 ? 'text-green-400' : 'text-red-400'}`}>{calculateWinRate(player.wins, player.games - player.wins)}% WR</p>
                                 <p className="text-slate-400 text-[10px]">{player.games} Game{player.games > 1 ? 's' : ''}</p>
                             </div>
                         </div>
                     );
                 })}
            </CardContent>
        </Card>
    );
}