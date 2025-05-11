'use client';

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useMemo, useState } from 'react';

import Link from 'next/link';
import React from 'react';

import {
    ChevronDown, ChevronUp,
    CircleSlash,
    ShieldAlert
} from 'lucide-react';

// Import shared Data Dragon & Riot API types
import type {
    DDragonArenaAugment,
    DDragonChampion,
    DDragonRuneTree,
    DDragonSummonerSpell,
    MatchDetailsData,
    MatchParticipantStats
} from '@/types/ddragon';

interface ArenaMatchDetailsProps {
  matchDetails: MatchDetailsData;
  searchedPlayerPuuid: string;
  currentPatchVersion: string;
  summonerSpellData?: Record<string, DDragonSummonerSpell>;
  runeTreeData?: DDragonRuneTree[];
  championData?: Record<string, DDragonChampion>;
  gameModeMap?: Record<number, string>;
  platformId: string;
  arenaAugmentData?: Record<number, DDragonArenaAugment>;
}

// --- Constants ---
const DDRAGON_BASE_URL = "https://ddragon.leagueoflegends.com/cdn";
const COMMUNITY_DRAGON_THEMED_ASSET_BASE = "https://raw.communitydragon.org/t/";
const defaultQueueIdToName: Record<number, string> = { 1700: "Arena" };
const ARENA_MIN_VALID_GAME_DURATION_FOR_SCORE = 180; // 3 minutes

// --- Helper Functions ---

// Generates the URL for an item image.
function getItemImageUrl(itemId: number, patchVersion: string): string | null {
  if (!itemId || itemId === 0) return null;
  return `${DDRAGON_BASE_URL}/${patchVersion}/img/item/${itemId}.png`;
}

// Gets the name of an item.
function getItemName(itemId: number): string {
    if (!itemId || itemId === 0) return "Empty Slot";
    // Assuming you might have itemData prop in the future or fetch it.
    // For now, returning a generic name.
    return `Item ID: ${itemId}`;
}

// Generates the URL for a champion's square icon.
function getChampionSquareAssetUrl(championApiName: string | undefined, patchVersion: string, champData?: ArenaMatchDetailsProps['championData']): string {
    if (!championApiName) return "https://placehold.co/48x48/1F2937/4A5563?text=C";
    let keyToUse = championApiName.replace(/[^a-zA-Z0-9]/g, '');
    if (champData) {
        const foundChamp = Object.values(champData).find(c => c.name === championApiName || c.id === championApiName);
        if (foundChamp) keyToUse = foundChamp.id;
    }
    return `${DDRAGON_BASE_URL}/${patchVersion}/img/champion/${keyToUse}.png`;
}

// Retrieves details for a summoner spell.
function getSummonerSpellDetails(
    spellApiId: number | undefined,
    patchVersion: string,
    spellData?: ArenaMatchDetailsProps['summonerSpellData']
): { name: string; description: string; imageUrl: string } | null {
    if (!spellApiId || !spellData) return null;
    const foundSpell = Object.values(spellData).find((s: DDragonSummonerSpell) => parseInt(s.key) === spellApiId);
    if (foundSpell) {
      return {
        name: foundSpell.name,
        description: foundSpell.description,
        imageUrl: `${DDRAGON_BASE_URL}/${patchVersion}/img/spell/${foundSpell.image.full}`
      };
    }
    return null;
}

// Generates the URL for an Arena augment image.
function getAugmentImageUrl(augmentId?: number, augmentData?: ArenaMatchDetailsProps['arenaAugmentData'], ddragonFullPatchVersion?: string ): string | null {
    if (!augmentId || augmentId === 0) return null;
    if (!augmentData) return "https://placehold.co/28x28/1f2937/374151?text=A"; // Placeholder if no augment data
    const foundAugment = augmentData[augmentId];
    if (!foundAugment) return "https://placehold.co/28x28/1f2937/374151?text=A"; // Placeholder if specific augment not found

    const iconPathFromData = foundAugment.iconSmall || foundAugment.iconLarge || foundAugment.iconPath;

    if (iconPathFromData && typeof iconPathFromData === 'string') {
        let relativePath = iconPathFromData.toLowerCase().replace(/\.dds$/, '.png');
        if (!relativePath.endsWith('.png')) relativePath += '.png';

        let cdragonPatchSegment = "latest"; // Default to latest for community dragon
        if (ddragonFullPatchVersion && ddragonFullPatchVersion !== "latest") {
            const parts = ddragonFullPatchVersion.split('.');
            cdragonPatchSegment = (parts.length >= 2) ? `${parts[0]}.${parts[1]}` : ddragonFullPatchVersion;
        }
        
        if (relativePath.startsWith('/')) relativePath = relativePath.substring(1);
        if (!relativePath.startsWith('assets/')) {
            relativePath = `assets/ux/cherry/augments/icons/${relativePath.split('/').pop()}`;
        }
        
        return `${COMMUNITY_DRAGON_THEMED_ASSET_BASE}${cdragonPatchSegment}/game/${relativePath}`;
    }
    return "https://placehold.co/28x28/1f2937/374151?text=A"; // Fallback placeholder
}

// Gets the name of an Arena augment.
function getAugmentName(augmentId?: number, augmentData?: ArenaMatchDetailsProps['arenaAugmentData']): string {
    if (!augmentId || !augmentData) return "Unknown Augment";
    return augmentData[augmentId]?.name || `Augment ID: ${augmentId}`;
}

function formatKDA(k: number, d: number, a: number): string { return `${k} / ${d} / ${a}`; }
function getKdaRatio(k: number, d: number, a: number): string {
    const ratio = d === 0 ? (k + a).toFixed(1) : ((k + a) / d).toFixed(2);
    return `${ratio}:1 KDA`;
}
function timeAgo(timestampMillis: number): string {
    const now = Date.now(); const seconds = Math.round((now - timestampMillis) / 1000);
    if (seconds < 60) return `${seconds}s ago`; const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`; const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h ago`; const days = Math.round(hours / 24);
    if (days < 2) return `1d ago`; if (days < 7) return `${days}d ago`;
    const weeks = Math.round(days / 7);
    if (weeks <= 4) return `${weeks}w ago`;
    return new Date(timestampMillis).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function formatGameDuration(durationInSeconds: number): string {
    const minutes = Math.floor(durationInSeconds / 60); const seconds = durationInSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}
const getPlacementTextShorthand = (placement?: number): string => {
    if (!placement) return "N/A";
    if (placement === 1) return "1st"; if (placement === 2) return "2nd";
    if (placement === 3) return "3rd"; if (placement === 4) return "4th";
    return `${placement}th`;
};
const getPlacementBadgeClasses = (placement?: number): string => {
    const baseClass = "text-xs px-1.5 py-0.5 font-semibold shadow rounded-sm";
    if (placement === 1) return `${baseClass} bg-yellow-500 text-yellow-950 border border-yellow-600`;
    if (placement && placement <= 4) return `${baseClass} bg-blue-600 text-blue-100 border border-blue-700`;
    if (placement) return `${baseClass} bg-red-700 text-red-100 border border-red-800`;
    return `${baseClass} text-gray-400 border-gray-600 bg-slate-700`;
};
const getAugmentRarityBorder = (rarity?: number): string => {
    switch (rarity) {
      case 0: return "border-slate-400"; // Silver
      case 1: return "border-yellow-500"; // Gold
      case 2: return "border-purple-500"; // Prismatic
      default: return "border-slate-600";
    }
};
const getPlacementColorClasses = (placement?: number): string => {
    if (placement === 1) return "border-yellow-500";
    if (placement && placement <= 4) return "border-blue-500";
    return "border-red-600";
};

function calculateArenaPerformanceScore(
    playerStats: MatchParticipantStats,
    allParticipants: MatchParticipantStats[],
    gameDurationSeconds: number
): number {
    if (gameDurationSeconds < ARENA_MIN_VALID_GAME_DURATION_FOR_SCORE) return 0;

    let score = 0;
    const placement = playerStats.subteamPlacement;
    if (placement === 1) score += 45;
    else if (placement === 2) score += 35;
    else if (placement === 3) score += 25;
    else if (placement === 4) score += 15;
    else if (placement && placement <= 6) score += 8;
    else if (placement && placement <= 8) score += 4;

    const k = playerStats.kills ?? 0;
    const d = playerStats.deaths ?? 0;
    const a = playerStats.assists ?? 0;
    const kdaRatio = (k + a * 0.7) / Math.max(1, d);
    if (kdaRatio >= 5) score += 20;
    else if (kdaRatio >= 3.5) score += 16;
    else if (kdaRatio >= 2.0) score += 12;
    else if (kdaRatio >= 1.0) score += 8;
    else score += 4; 
    if ((k + a) >= 20) score += 7; 
    else if ((k + a) >= 10) score += 3;
    if (d === 0 && (k + a) >= 3) score += 3; 

    const totalDamageDealt = playerStats.totalDamageDealtToChampions ?? 0;
    let maxDamageInGame = 0;
    allParticipants.forEach(p => {
        if ((p.totalDamageDealtToChampions ?? 0) > maxDamageInGame) {
            maxDamageInGame = p.totalDamageDealtToChampions ?? 0;
        }
    });
    if (maxDamageInGame > 0) {
        const damageRatio = totalDamageDealt / maxDamageInGame;
        if (damageRatio >= 0.85) score += 10; 
        else if (damageRatio >= 0.65) score += 7;
        else if (damageRatio >= 0.40) score += 4;
    }

    const totalHealing = playerStats.totalHeal ?? 0;
    const totalShielding = playerStats.totalDamageShieldedOnTeammates ?? 0; 
    const totalSupportStats = totalHealing + totalShielding;
    if (totalSupportStats >= 15000) score += 15;
    else if (totalSupportStats >= 10000) score += 10;
    else if (totalSupportStats >= 5000) score += 7;
    else if (totalSupportStats >= 2000) score += 3;
    
    return Math.min(Math.max(Math.round(score), 0), 100);
}

interface CircularProgressScoreProps { score: number; isInvalidGame: boolean; size?: number; strokeWidth?: number; hideLabel?: boolean; }
const CircularProgressScore: React.FC<CircularProgressScoreProps> = ({ score, isInvalidGame, size = 50, strokeWidth = 4, hideLabel = false }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = isInvalidGame ? circumference : circumference - (score / 100) * circumference;
  const getPerformanceColorClass = (s: number) => {
    if (isInvalidGame) return "stroke-slate-500";
    if (s >= 85) return "stroke-purple-500"; if (s >= 70) return "stroke-sky-500";
    if (s >= 55) return "stroke-emerald-500"; if (s >= 40) return "stroke-yellow-500";
    return "stroke-red-500";
  };
  const getPerformanceTextColorClass = (s: number) => {
    if (isInvalidGame) return "fill-slate-400";
    if (s >= 85) return "fill-purple-300"; if (s >= 70) return "fill-sky-300";
    if (s >= 55) return "fill-emerald-300"; if (s >= 40) return "fill-yellow-300";
    return "fill-red-300";
  };
  return (
    <div className="flex flex-col items-center justify-center h-full" title={isInvalidGame ? "Score N/A (Short Game)" : `Performance Score: ${score}/100`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle className="text-slate-700" strokeWidth={strokeWidth} stroke="currentColor" fill="transparent" r={radius} cx={size / 2} cy={size / 2} />
        <circle 
          className={getPerformanceColorClass(score)} 
          strokeWidth={strokeWidth} 
          strokeDasharray={circumference} 
          strokeDashoffset={offset} 
          strokeLinecap="round" 
          stroke="currentColor" 
          fill="transparent" 
          r={radius} 
          cx={size / 2} 
          cy={size / 2} 
        />
        <text 
          x="50%" y="50%" 
          dy=".3em" 
          textAnchor="middle" 
          className={`text-base font-semibold ${getPerformanceTextColorClass(score)} rotate-90 origin-center`}
          style={{ fontSize: size < 40 ? '10px' : '1rem' }}
        >
          {isInvalidGame ? "N/A" : score}
        </text>
      </svg>
      {!isInvalidGame && !hideLabel && <span className="text-[10px] text-slate-400 mt-1">Score</span>}
    </div>
  );
};

interface ArenaTeam { subteamId: number; placement: number; members: MatchParticipantStats[]; }

export function ArenaMatchDetails({
  matchDetails, searchedPlayerPuuid, currentPatchVersion,
  summonerSpellData, championData, gameModeMap = defaultQueueIdToName,
  arenaAugmentData, platformId,
}: ArenaMatchDetailsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { info } = matchDetails;

  const searchedPlayerStats = useMemo(() => info.participants.find((p: MatchParticipantStats) => p.puuid === searchedPlayerPuuid), [info.participants, searchedPlayerPuuid]);

  const arenaTeams: ArenaTeam[] = useMemo(() => {
    const groupedBySubteam: Record<number, MatchParticipantStats[]> = {};
    info.participants.forEach((p: MatchParticipantStats) => {
        if (p.playerSubteamId) { 
            if (!groupedBySubteam[p.playerSubteamId]) groupedBySubteam[p.playerSubteamId] = [];
            groupedBySubteam[p.playerSubteamId].push(p);
        } else { 
            console.warn("Participant missing playerSubteamId in Arena match:", p);
        }
    });
    return Object.entries(groupedBySubteam)
        .map(([subteamId, members]) => ({ 
            subteamId: parseInt(subteamId), 
            placement: members[0]?.subteamPlacement ?? 99, 
            members: members.sort((a,b) => a.participantId - b.participantId), 
        }))
        .sort((teamA, teamB) => teamA.placement - teamB.placement); 
  }, [info.participants]);

  const performanceScore = useMemo(() => {
    if (!searchedPlayerStats || !info.participants) return 0;
    return calculateArenaPerformanceScore(searchedPlayerStats, info.participants, info.gameDuration);
  }, [searchedPlayerStats, info.participants, info.gameDuration]);

  const isInvalidGameForScore = useMemo(() => info.gameDuration < ARENA_MIN_VALID_GAME_DURATION_FOR_SCORE, [info.gameDuration]);
  
  const spell1Details = useMemo(() => {
    if (!searchedPlayerStats) return null; 
    return getSummonerSpellDetails(searchedPlayerStats.summoner1Id, currentPatchVersion, summonerSpellData);
  }, [searchedPlayerStats, currentPatchVersion, summonerSpellData]);

  const spell2Details = useMemo(() => {
    if (!searchedPlayerStats) return null; 
    return getSummonerSpellDetails(searchedPlayerStats.summoner2Id, currentPatchVersion, summonerSpellData);
  }, [searchedPlayerStats, currentPatchVersion, summonerSpellData]);

  if (!searchedPlayerStats) {
      return (
          <Alert variant="destructive" className="mb-3">
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>Searched player data not found in this Arena match.</AlertDescription>
          </Alert>
      );
  }

  const player = searchedPlayerStats; 

  const gameEndTime = info.gameEndTimestamp || (info.gameCreation + info.gameDuration * 1000);
  const gameModeName = gameModeMap[info.queueId] || info.gameMode?.replace(/_/g, ' ') || "Arena";
  const playerPlacement = player.subteamPlacement;
  
  const playerItemsRow1 = [player.item0, player.item1, player.item2, player.item6];
  const playerItemsRow2 = [player.item3, player.item4, player.item5];
  const playerAugments = [player.playerAugment1, player.playerAugment2, player.playerAugment3, player.playerAugment4].filter((augId): augId is number => !!augId && augId !== 0);

  const isWin = playerPlacement !== undefined && playerPlacement <= 4; 
  const outcomeBorderColor = getPlacementColorClasses(playerPlacement);
  const outcomeBgGradient = !isWin ? "from-red-900/20 via-slate-900/30 to-slate-950/50" 
                          : (playerPlacement === 1 ? "from-yellow-800/20 via-slate-900/30 to-slate-950/50" 
                          : "from-blue-900/20 via-slate-900/30 to-slate-950/50");

  return (
    <TooltipProvider delayDuration={100}>
        <Collapsible
            open={isOpen}
            onOpenChange={setIsOpen}
            className={`match-card-arena mb-3 shadow-lg rounded-lg overflow-hidden bg-slate-900 text-gray-300 border border-slate-700/50 border-l-4 ${outcomeBorderColor}`}
        >
          <CollapsibleTrigger asChild>
            <div 
              className={`w-full block hover:brightness-125 transition-all cursor-pointer bg-gradient-to-r ${outcomeBgGradient}`} 
              onClick={(e) => { 
                if ((e.target as HTMLElement).closest('button, a, [data-state]')) return; 
                setIsOpen(!isOpen); 
              }}
            >
              <div className="p-3">
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                  <div className={`flex flex-col items-center justify-center text-center w-[75px] sm:w-[85px] shrink-0 p-1.5 rounded-md ${isWin ? (playerPlacement === 1 ? 'bg-yellow-950/30' : 'bg-blue-950/20') : 'bg-red-950/20'}`}>
                    <span className={`font-bold text-lg ${playerPlacement === 1 ? 'text-yellow-400' : (isWin ? 'text-blue-400' : 'text-red-400')}`}>
                      {getPlacementTextShorthand(playerPlacement)}
                    </span>
                    <div className="text-xs font-medium text-gray-300 mt-0.5 uppercase truncate w-full" title={gameModeName}>{gameModeName}</div>
                    <div className="text-[10px] text-gray-400">{formatGameDuration(info.gameDuration)}</div>
                    <div className="text-[10px] text-gray-400">{timeAgo(gameEndTime)}</div>
                  </div>
                  <div className="flex flex-col items-center shrink-0">
                    <Tooltip>
                        <TooltipTrigger asChild><Avatar className="h-12 w-12 sm:h-14 sm:w-14 border-2 border-slate-600 rounded-md">
                            <AvatarImage src={getChampionSquareAssetUrl(player.championName, currentPatchVersion, championData)} alt={player.championName || "Champion"} />
                            <AvatarFallback className="text-gray-400">{player.championName?.[0]}</AvatarFallback>
                        </Avatar></TooltipTrigger>
                        <TooltipContent className="bg-black text-white border-slate-700 text-xs p-1.5 rounded-md shadow-lg">
                            <p>{player.championName || "Champion"}</p>
                        </TooltipContent>
                    </Tooltip>
                    <span className="text-[10px] text-center font-medium text-gray-300 mt-0.5 bg-slate-800/70 px-1 rounded-sm">
                      Lvl {player.champLevel}
                    </span>
                  </div>
                  <div className="flex-grow flex flex-col justify-center px-1 sm:px-2 space-y-1.5 mr-5">
                      <div className="flex items-center gap-2 text-sm sm:text-base">
                          <div className="flex items-baseline gap-0.5">
                              <span className="font-bold text-gray-100">{player.kills}</span><span className="text-gray-500 text-xs">/</span>
                              <span className="font-bold text-red-400">{player.deaths}</span><span className="text-gray-500 text-xs">/</span>
                              <span className="font-bold text-gray-100">{player.assists}</span>
                          </div>
                          <div className="border-l border-slate-600 h-4 self-center"></div>
                          <p className="text-sm sm:text-base text-gray-400">{getKdaRatio(player.kills,player.deaths,player.assists)}</p>
                      </div>
                      <div className="flex items-center gap-1">
                          {Array.from({ length: 4 }).map((_, idx) => { 
                              const augId = playerAugments[idx]; 
                              const augmentInfo = arenaAugmentData && augId ? arenaAugmentData[augId] : undefined;
                              const augmentImageUrl = getAugmentImageUrl(augId, arenaAugmentData, currentPatchVersion);
                              return (
                                  <Tooltip key={`player-aug-main-${idx}-${augId || 'empty'}`}>
                                      <TooltipTrigger asChild>
                                          <Avatar className={`h-7 w-7 rounded-sm border-2 ${getAugmentRarityBorder(augmentInfo?.rarity)} bg-slate-800 flex items-center justify-center`}>
                                              {augmentImageUrl ? <AvatarImage src={augmentImageUrl} alt={getAugmentName(augId, arenaAugmentData)} /> : <CircleSlash className="h-4 w-4 text-slate-500" />}
                                          </Avatar>
                                      </TooltipTrigger>
                                      <TooltipContent className="bg-black text-white border-slate-700 text-xs p-1.5 rounded-md shadow-lg max-w-[200px]"><p>{getAugmentName(augId, arenaAugmentData)}</p></TooltipContent>
                                  </Tooltip>
                              );
                          })}
                      </div>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-slate-800/60 rounded-md shadow-inner shrink-0 mr-2"> 
                    <div className="flex flex-col gap-1">
                        {spell1Details ? (
                            <Tooltip>
                                <TooltipTrigger asChild><Avatar className="h-7 w-7 rounded-sm bg-slate-700 flex items-center justify-center">
                                    <AvatarImage src={spell1Details.imageUrl} alt={spell1Details.name}/>
                                </Avatar></TooltipTrigger>
                                <TooltipContent className="bg-black text-white border-slate-700 text-xs p-1.5 rounded-md shadow-lg max-w-xs">
                                    <p className="font-semibold mb-0.5">{spell1Details.name}</p>
                                    <p className="text-slate-300" dangerouslySetInnerHTML={{ __html: spell1Details.description }}/>
                                </TooltipContent>
                            </Tooltip>
                        ) : (
                            <Avatar className="h-7 w-7 rounded-sm bg-slate-700 flex items-center justify-center"><CircleSlash className="h-4 w-4 text-slate-500"/></Avatar>
                        )}
                        {spell2Details ? (
                             <Tooltip>
                                <TooltipTrigger asChild><Avatar className="h-7 w-7 rounded-sm bg-slate-700 flex items-center justify-center">
                                    <AvatarImage src={spell2Details.imageUrl} alt={spell2Details.name}/>
                                </Avatar></TooltipTrigger>
                                <TooltipContent className="bg-black text-white border-slate-700 text-xs p-1.5 rounded-md shadow-lg max-w-xs">
                                    <p className="font-semibold mb-0.5">{spell2Details.name}</p>
                                    <p className="text-slate-300" dangerouslySetInnerHTML={{ __html: spell2Details.description }}/>
                                </TooltipContent>
                            </Tooltip>
                        ) : (
                            <Avatar className="h-7 w-7 rounded-sm bg-slate-700 flex items-center justify-center"><CircleSlash className="h-4 w-4 text-slate-500"/></Avatar>
                        )}
                    </div>
                    <div className="border-l border-slate-600/70 h-14 self-stretch mx-1.5"></div>
                    <div className="flex flex-col gap-0.5">
                        <div className="flex gap-0.5">
                            {playerItemsRow1.map((itemId, idx) => {
                                const imageUrl = getItemImageUrl(itemId, currentPatchVersion);
                                const itemName = getItemName(itemId); 
                                return (
                                <Tooltip key={`player-item-row1-${idx}-${itemId}`}>
                                    <TooltipTrigger asChild><Avatar className="h-7 w-7 rounded-sm bg-slate-700 flex items-center justify-center">
                                        {imageUrl ? <AvatarImage src={imageUrl} alt={itemName}/> : <CircleSlash className="h-4 w-4 text-slate-500"/>}
                                    </Avatar></TooltipTrigger>
                                    <TooltipContent className="bg-black text-white border-slate-700 text-xs p-1.5 rounded-md shadow-lg max-w-[200px]"><p>{itemName}</p></TooltipContent>
                                </Tooltip>
                                );
                            })}
                        </div>
                        <div className="flex gap-0.5">
                            {playerItemsRow2.map((itemId, idx) => {
                                const imageUrl = getItemImageUrl(itemId, currentPatchVersion);
                                const itemName = getItemName(itemId);
                                return (
                                <Tooltip key={`player-item-row2-${idx}-${itemId}`}>
                                    <TooltipTrigger asChild><Avatar className="h-7 w-7 rounded-sm bg-slate-700 flex items-center justify-center">
                                        {imageUrl ? <AvatarImage src={imageUrl} alt={itemName}/> : <CircleSlash className="h-4 w-4 text-slate-500"/>}
                                    </Avatar></TooltipTrigger>
                                    <TooltipContent className="bg-black text-white border-slate-700 text-xs p-1.5 rounded-md shadow-lg max-w-[200px]"><p>{itemName}</p></TooltipContent>
                                </Tooltip>
                                );
                            })}
                            {playerItemsRow2.length < 3 && Array(3 - playerItemsRow2.length).fill(0).map((_, emptyIdx) => (
                                <Avatar key={`empty-item-row2-${emptyIdx}`} className="h-7 w-7 rounded-sm bg-slate-700/70 flex items-center justify-center">
                                    <CircleSlash className="h-4 w-4 text-slate-600" />
                                </Avatar>
                            ))}
                        </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-center shrink-0 w-16 md:w-20 ml-auto mr-2"> 
                       <CircularProgressScore score={performanceScore} isInvalidGame={isInvalidGameForScore} size={48} strokeWidth={4}/>
                  </div>
                  <div className="flex items-center pl-1 shrink-0 self-center"> 
                      <Button variant="ghost" size="icon" className="h-7 w-7 data-[state=open]:bg-slate-700 hover:bg-slate-600 rounded-full text-gray-400 hover:text-gray-200">
                          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                  </div>
                </div>
              </div>
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Separator className="my-0 bg-slate-700" />
            <CardContent className="p-3 sm:p-4 space-y-3 text-xs sm:text-sm bg-slate-900/60 rounded-b-md">
              <div className="space-y-3">
                {arenaTeams.map((team) => (
                  <Card key={`full-team-${team.subteamId}`} className={`bg-slate-800/50 border-l-4 ${getPlacementColorClasses(team.placement)} border-y border-r border-slate-700/50 shadow-sm overflow-hidden`}>
                    <CardHeader className="py-2 px-3 bg-slate-700/30 rounded-t-md">
                        <CardTitle className="text-sm font-semibold flex justify-between items-center text-gray-100">
                            <span>Team (Placement: <span className={getPlacementBadgeClasses(team.placement)}>{getPlacementTextShorthand(team.placement)}</span>)</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs min-w-[600px] sm:min-w-full">
                                <thead className="bg-slate-700/20">
                                    <tr>
                                        <th className="p-1.5 text-left font-medium text-gray-300 w-2/5">Player</th>
                                        <th className="p-1.5 text-center font-medium text-gray-300">KDA</th>
                                        <th className="p-1.5 text-center font-medium text-gray-300">Gold</th>
                                        <th className="p-1.5 text-left font-medium text-gray-300">Augments</th>
                                        <th className="p-1.5 text-left font-medium text-gray-300">Items</th>
                                    </tr>
                                </thead>
                                <tbody>{/* Ensure no whitespace text node here */}
                                    {team.members.map((p: MatchParticipantStats) => (
                                        <tr key={p.puuid} className={`border-t border-slate-700/50 ${p.puuid === searchedPlayerPuuid ? 'bg-blue-900/20' : 'hover:bg-slate-700/10'}`}>
                                            <td className="p-1.5 whitespace-nowrap">
                                                <div className="flex items-center gap-1.5">
                                                    <Avatar className="h-7 w-7 rounded-md"><AvatarImage src={getChampionSquareAssetUrl(p.championName, currentPatchVersion, championData)} alt={p.championName}/></Avatar>
                                                    <div className="flex flex-col leading-tight">
                                                        <Link href={`/profile/${platformId}/${encodeURIComponent(p.riotIdGameName || p.summonerName)}-${encodeURIComponent(p.riotIdTagline || "")}`} className="hover:text-purple-300 hover:underline transition-colors">
                                                          <span className="truncate font-medium text-gray-100 max-w-[100px] sm:max-w-[150px]" title={`${p.riotIdGameName || p.summonerName}${p.riotIdTagline ? `#${p.riotIdTagline}`: ''}`}>{p.riotIdGameName || p.summonerName}</span>
                                                        </Link>
                                                        {p.riotIdTagline && <span className="text-gray-500 text-[9px]">#{p.riotIdTagline}</span>}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-1.5 text-center text-gray-200">{formatKDA(p.kills, p.deaths, p.assists)}</td>
                                            <td className="p-1.5 text-center text-gray-200">{(p.goldEarned / 1000).toFixed(1)}k</td>
                                            <td className="p-1.5">
                                                <div className="flex gap-0.5">
                                                    {[p.playerAugment1, p.playerAugment2, p.playerAugment3, p.playerAugment4].map((augId, idx) => {
                                                        const augmentInfo = arenaAugmentData && augId ? arenaAugmentData[augId] : undefined;
                                                        const augImageUrl = getAugmentImageUrl(augId, arenaAugmentData, currentPatchVersion);
                                                        return (
                                                            <Tooltip key={`table-aug-${p.puuid}-${idx}-${augId || 'empty'}`}>
                                                                <TooltipTrigger asChild>
                                                                    <Avatar className={`h-5 w-5 rounded-sm border ${getAugmentRarityBorder(augmentInfo?.rarity)} bg-slate-800 flex items-center justify-center`}>
                                                                        {augImageUrl ? <AvatarImage src={augImageUrl} alt={getAugmentName(augId, arenaAugmentData)} /> : <CircleSlash className="h-3 w-3 text-slate-600" />}
                                                                    </Avatar>
                                                                </TooltipTrigger>
                                                                <TooltipContent className="bg-black text-white border-slate-700 text-xs p-1 max-w-[180px]"><p>{getAugmentName(augId, arenaAugmentData)}</p></TooltipContent>
                                                            </Tooltip>
                                                        );
                                                    })}
                                                </div>
                                            </td>
                                            <td className="p-1.5">
                                                <div className="flex gap-0.5">
                                                    {[p.item0, p.item1, p.item2, p.item3, p.item4, p.item5, p.item6].map((itemId, idx) => {
                                                        const imageUrl = getItemImageUrl(itemId, currentPatchVersion);
                                                        const itemName = getItemName(itemId);
                                                        return (
                                                            <Tooltip key={`table-item-${p.puuid}-${idx}-${itemId}`}>
                                                                <TooltipTrigger asChild><Avatar className="h-5 w-5 rounded-sm bg-slate-800 flex items-center justify-center">
                                                                    {imageUrl ? <AvatarImage src={imageUrl} alt={itemName}/> : <CircleSlash className="h-3 w-3 text-slate-600" />}
                                                                </Avatar></TooltipTrigger>
                                                                <TooltipContent className="bg-black text-white border-slate-700 text-xs p-1 max-w-[180px]"><p>{itemName}</p></TooltipContent>
                                                            </Tooltip>
                                                        );
                                                    })}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>{/* Ensure no whitespace text node here */}
                            </table>
                        </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
    </TooltipProvider>
  );
}
