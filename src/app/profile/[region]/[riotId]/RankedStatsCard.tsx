// app/profile/[region]/[riotId]/RankedStatsCard.tsx
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { LeagueEntryDTO } from '@/types/ddragon';
import { Loader2 } from 'lucide-react';
// *** Import TRPC error type ***
import type { AppRouter } from '@/trpc/routers/_app'; // Adjust path if needed
import type { TRPCClientErrorLike } from '@trpc/client';
import Image from 'next/image'; // Import the Next.js Image component

interface RankedStatsCardProps {
  soloRank: LeagueEntryDTO | undefined;
  flexRank: LeagueEntryDTO | undefined;
  isLoading: boolean;
  // *** Update error prop type ***
  error: TRPCClientErrorLike<AppRouter> | null;
}

// Helper function (can be shared or kept local)
function getRankIconUrl(tier?: string): string {
    const basePath = '/images/ranked-emblems/'; // Ensure this path is correct
    if (!tier || tier.toLowerCase() === 'unranked' || tier.toLowerCase() === 'none') { // Added 'none' for robustness
        return `${basePath}Rank=Unranked.png`; 
    }
    const tierName = tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase();
    // List of known (and presumably existing) emblem filenames
    const knownTiers = ["Iron", "Bronze", "Silver", "Gold", "Platinum", "Emerald", "Diamond", "Master", "Grandmaster", "Challenger"];
    if (knownTiers.includes(tierName)) {
        const filename = `Rank=${tierName}.png`;
        return `${basePath}${filename}`;
    }
    return `${basePath}Rank=Unranked.png`; // Fallback to Unranked if tier is not recognized
}

function calculateWinRate(wins: number, losses: number): number {
    const totalGames = wins + losses;
    return totalGames === 0 ? 0 : Math.round((wins / totalGames) * 100);
}


export function RankedStatsCard({ soloRank, flexRank, isLoading, error }: RankedStatsCardProps) {
  return (
    <Card className="bg-slate-800/60 border border-slate-700/50 shadow-sm">
      <CardHeader className="pb-2 pt-3 px-3">
        <CardTitle className="text-base font-semibold text-gray-100">Ranked Stats</CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3 space-y-2">
        {isLoading && <div className="flex justify-center p-1"><Loader2 className="h-4 w-4 animate-spin text-slate-400"/></div>}
        {/* Display error message if present */}
        {error && <p className="text-[11px] text-red-400">Error: {error.message}</p>}
        {!isLoading && !error && !soloRank && !flexRank && <p className="text-xs text-slate-400 italic">Unranked</p>}

        {/* Solo/Duo Display */}
        {!error && soloRank && (
            <div className="flex items-center gap-2 p-1.5 rounded-md bg-slate-700/40">
                <Image 
                    src={getRankIconUrl(soloRank.tier)} 
                    alt={`${soloRank.tier || 'Unranked'} Emblem`} 
                    width={40} // h-10 w-10 translates to 40px
                    height={40}
                    className="object-contain" 
                    // onError is not directly supported by next/image for client-side src replacement.
                    // Ensure getRankIconUrl returns a valid placeholder if an image might be missing.
                />
                <div>
                    <p className="font-medium text-xs text-slate-200">Ranked Solo/Duo</p>
                    <p className="text-[11px] text-slate-300">{soloRank.tier} {soloRank.rank} - {soloRank.leaguePoints} LP</p>
                    <p className="text-[10px] text-slate-400">{soloRank.wins}W / {soloRank.losses}L ({calculateWinRate(soloRank.wins, soloRank.losses)}%)</p>
                </div>
            </div>
        )}
        {/* Flex Rank Display */}
        {!error && flexRank && (
            <div className="flex items-center gap-2 p-1.5 rounded-md bg-slate-700/40">
                 <Image 
                    src={getRankIconUrl(flexRank.tier)} 
                    alt={`${flexRank.tier || 'Unranked'} Emblem`} 
                    width={40} // h-10 w-10 translates to 40px
                    height={40}
                    className="object-contain"
                />
                <div>
                    <p className="font-medium text-xs text-slate-200">Ranked Flex</p>
                    <p className="text-[11px] text-slate-300">{flexRank.tier} {flexRank.rank} - {flexRank.leaguePoints} LP</p>
                    <p className="text-[10px] text-slate-400">{flexRank.wins}W / {flexRank.losses}L ({calculateWinRate(flexRank.wins, flexRank.losses)}%)</p>
                </div>
            </div>
        )}
      </CardContent>
    </Card>
  );
}
