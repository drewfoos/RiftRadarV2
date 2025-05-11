'use client';

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import Image from 'next/image';
import Link from 'next/link';
import React, { JSX, useMemo, useRef, useState } from 'react';

import {
    BarChartHorizontalBig,
    BookOpen,
    ChevronDown, ChevronUp,
    CircleSlash // Added CircleSlash
    ,
    Diamond,
    Eye,
    Flame,
    Mountain,
    Scale,
    ShieldAlert,
    Sparkles,
    Star,
    Swords,
    TowerControl,
    Trophy,
    Zap,
    ZapIcon
} from 'lucide-react';

import type {
    DDragonChampion,
    DDragonItem,
    DDragonRune,
    DDragonRuneTree,
    DDragonSummonerSpell,
    MatchDetailsData,
    MatchParticipantStats,
    PerkStatsDto,
    PerkStyleDto,
    PerksDto,
    TeamDto
} from '@/types/ddragon';

interface ClassicMatchDetailsProps {
  matchDetails: MatchDetailsData;
  searchedPlayerPuuid: string;
  currentPatchVersion: string;
  summonerSpellData?: Record<string, DDragonSummonerSpell>;
  runeTreeData?: DDragonRuneTree[];
  championData?: Record<string, DDragonChampion>;
  itemData?: Record<string, DDragonItem>;
  gameModeMap?: Record<number, string>;
  platformId: string;
}

interface ResolvedParticipantRunes {
  keystone?: DDragonRune;
  primaryRunes: (DDragonRune | undefined)[];
  secondaryRunes: (DDragonRune | undefined)[];
  primaryTreeName?: string;
  secondaryTreeName?: string;
  statPerks?: PerkStatsDto;
}


const DDRAGON_BASE_URL = "https://ddragon.leagueoflegends.com/cdn";
const defaultQueueIdToName: Record<number, string> = {
  400: "Normal Draft", 420: "Ranked Solo", 430: "Normal Blind", 440: "Ranked Flex",
  450: "ARAM", 700: "Clash", 1900: "URF",
};

// --- Helper Functions ---
function getItemImageUrl(itemId: number, patchVersion: string): string | null { // Returns string or null
  if (!itemId || itemId === 0) return null; // Return null for empty slots
  return `${DDRAGON_BASE_URL}/${patchVersion}/img/item/${itemId}.png`;
}
function getItemName(itemId: number, itemData?: ClassicMatchDetailsProps['itemData']): string {
    if (!itemId || itemId === 0) return "Empty Slot";
    if (!itemData || !itemData[String(itemId)]) return `Item ID: ${itemId}`;
    return itemData[String(itemId)].name;
}
function getSummonerSpellDetails(
    spellApiId: number | undefined,
    patchVersion: string,
    spellData?: ClassicMatchDetailsProps['summonerSpellData']
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
function getChampionSquareAssetUrl(
    championApiName: string | undefined,
    patchVersion: string,
    champData?: ClassicMatchDetailsProps['championData']
): string {
    if (!championApiName) return "https://placehold.co/40x40/1f2937/374151?text=C";
    let keyToUse = championApiName.replace(/[^a-zA-Z0-9]/g, '');
    if (champData) {
        const foundChamp = Object.values(champData).find(c => c.name === championApiName || c.id === championApiName);
        if (foundChamp) keyToUse = foundChamp.id;
    }
    return `${DDRAGON_BASE_URL}/${patchVersion}/img/champion/${keyToUse}.png`;
}
function findRuneTreeById(runeTreeData: DDragonRuneTree[] | null | undefined, treeId: number): DDragonRuneTree | undefined {
    if (!runeTreeData) return undefined;
    return runeTreeData.find(tree => tree.id === treeId);
}
function findRuneById(runeTree: DDragonRuneTree | undefined, runeId: number): DDragonRune | undefined {
    if (!runeTree) return undefined;
    for (const slot of runeTree.slots) {
        const foundRune = slot.runes.find(rune => rune.id === runeId);
        if (foundRune) return foundRune;
    }
    return undefined;
}
function getRuneOrTreeIconUrl(
    id: number | undefined,
    patchVersion: string,
    runeTrees?: ClassicMatchDetailsProps['runeTreeData'],
    isTreeIcon?: boolean
): string {
    const placeholder = `https://placehold.co/24x24/1f2937/374151?text=R`;
    if (!id || !runeTrees) return placeholder;
    try {
        const tree = runeTrees.find((t: DDragonRuneTree) => t.id === id);
        if (tree?.icon) {
            return `${DDRAGON_BASE_URL}/img/${tree.icon}`;
        }
        if (!isTreeIcon) {
            for (const t of runeTrees) {
                for (const slot of t.slots) {
                    const foundRune = slot.runes.find((r: DDragonRune) => r.id === id);
                    if (foundRune?.icon) return `${DDRAGON_BASE_URL}/img/${foundRune.icon}`;
                }
            }
        }
    } catch (error) {
        console.error("Error finding rune/tree icon:", error);
    }
    return placeholder;
}

const statPerkDetailsById: Record<number, { name: string; iconPath?: string }> = {
    5008: { name: "Adaptive Force", iconPath: "perk-images/StatMods/StatModsAdaptiveForceIcon.png" },
    5005: { name: "Attack Speed", iconPath: "perk-images/StatMods/StatModsAttackSpeedIcon.png" },
    5007: { name: "Ability Haste", iconPath: "perk-images/StatMods/StatModsCDRScalingIcon.png" },
    5002: { name: "Armor", iconPath: "perk-images/StatMods/StatModsArmorIcon.png" },
    5003: { name: "Magic Resist", iconPath: "perk-images/StatMods/StatModsMagicResIcon.png" },
    5001: { name: "Health", iconPath: "perk-images/StatMods/StatModsHealthScalingIcon.png" },
};

const defaultStatPerkDetails = {
    offense: { name: "Offense", IconComponent: Zap },
    flex: { name: "Flex", IconComponent: Diamond },
    defense: { name: "Defense", IconComponent: ShieldAlert }
};


function getStatPerkIconUrl(perkId: number | undefined, type?: 'offense' | 'flex' | 'defense'): string {
    if (perkId !== undefined) {
        const detail = statPerkDetailsById[perkId];
        if (detail?.iconPath) {
            return `${DDRAGON_BASE_URL}/img/${detail.iconPath}`;
        }
    }
    return "https://placehold.co/18x18/1f2937/374151?text=S";
}

function getStatPerkName(perkId: number | undefined, type?: 'offense' | 'flex' | 'defense'): string {
    if (perkId !== undefined) {
        const detail = statPerkDetailsById[perkId];
        if (detail?.name) {
            return detail.name;
        }
    }
    if (type) {
        return defaultStatPerkDetails[type]?.name || "Stat Perk";
    }
    return "Stat Perk";
}


function timeAgo(timestampMillis: number): string {
    const now = Date.now();
    const seconds = Math.round((now - timestampMillis) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    if (days < 2) return `1d ago`;
    if (days < 7) return `${days}d ago`;
    const weeks = Math.round(days / 7);
    if (weeks <= 4) return `${weeks}w ago`;
    return new Date(timestampMillis).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function formatGameDuration(durationInSeconds: number): string {
    const minutes = Math.floor(durationInSeconds / 60);
    const seconds = durationInSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}
type PlayerRole = "TOP" | "JUNGLE" | "MIDDLE" | "BOTTOM" | "UTILITY" | "UNKNOWN";

function calculatePerformanceScore(
    playerStats: MatchParticipantStats,
    teamTotalKills: number,
    gameDurationSeconds: number,
    isGameRemake: boolean
): number {
    if (isGameRemake || gameDurationSeconds < 300 || (playerStats.gameEndedInEarlySurrender ?? false)) {
        return 0;
    }
    let score = 0;
    const gameDurationMinutes = gameDurationSeconds / 60;
    if (gameDurationMinutes === 0) return 0;

    const playerRole = (playerStats.teamPosition?.toUpperCase() || playerStats.individualPosition?.toUpperCase() || "UNKNOWN") as PlayerRole;

    let kdaValue = playerStats.deaths === 0 ? (playerStats.kills + playerStats.assists) * 1.5 : (playerStats.kills + playerStats.assists) / playerStats.deaths;
    if (playerRole === "UTILITY") {
        kdaValue = playerStats.deaths === 0 ? (playerStats.kills * 0.75 + playerStats.assists * 1.25) * 1.5 : (playerStats.kills * 0.5 + playerStats.assists * 1.5) / playerStats.deaths;
        if (kdaValue >= 8) score += 33; else if (kdaValue >= 6) score += 28; else if (kdaValue >= 4) score += 22; else if (kdaValue >= 2.5) score += 16; else if (kdaValue >= 1.5) score += 11;
    } else {
        if (kdaValue >= 7) score += 33; else if (kdaValue >= 5) score += 28; else if (kdaValue >= 3.5) score += 22; else if (kdaValue >= 2) score += 16; else if (kdaValue >= 1) score += 11;
    }
    if (playerStats.deaths === 0 && (playerStats.kills + playerStats.assists) >= 10) {
        score += 5;
    }

    const dpm = (playerStats.totalDamageDealtToChampions ?? 0) / gameDurationMinutes;
    if (playerRole === "UTILITY") {
        if (dpm >= 300) score += 16; else if (dpm >= 150) score += 11; else if (dpm >= 50) score += 5;
    } else {
        if (dpm >= 800) score += 26; else if (dpm >= 600) score += 21; else if (dpm >= 400) score += 16; else if (dpm >= 200) score += 11;
    }

    const cspm = ((playerStats.totalMinionsKilled ?? 0) + (playerStats.neutralMinionsKilled ?? 0)) / gameDurationMinutes;
    if (playerRole !== "UTILITY") {
        if (playerRole === "JUNGLE") {
            if (cspm >= 6) score += 16; else if (cspm >= 4.5) score += 11; else if (cspm >= 3) score += 5;
        } else {
            if (cspm >= 8) score += 16; else if (cspm >= 6.5) score += 11; else if (cspm >= 5) score += 5;
        }
    }

    const vspm = (playerStats.visionScore ?? 0) / gameDurationMinutes;
    if (playerRole === "UTILITY") {
        if (vspm >= 2.0) score += 16; else if (vspm >= 1.5) score += 11; else if (vspm >= 0.8) score += 5;
    } else if (playerRole === "JUNGLE") {
        if (vspm >= 1.2) score += 16; else if (vspm >= 0.8) score += 11; else if (vspm >= 0.4) score += 5;
    } else {
        if (vspm >= 0.8) score += 11; else if (vspm >= 0.5) score += 5;
    }
    const teamKills = teamTotalKills > 0 ? teamTotalKills : 1;
    const kp = (((playerStats.kills ?? 0) + (playerStats.assists ?? 0)) / teamKills) * 100;
    if (kp >= 70) score += 16; else if (kp >= 55) score += 11; else if (kp >= 40) score += 8; else if (kp >= 25) score += 4;

    if (playerStats.win) {
        score += 8;
    }

    return Math.min(Math.max(Math.round(score), 0), 100);
}

interface HighlightTag { label: string; icon?: JSX.Element; className?: string; tooltip?: string; }
function getHighlightTag(
    playerStats: MatchParticipantStats,
    gameDurationSeconds: number,
    isGameRemake: boolean
): HighlightTag | null {
    if (isGameRemake || gameDurationSeconds < 300 || (playerStats.gameEndedInEarlySurrender ?? false)) {
        return null;
    }
    const gameDurationMinutes = gameDurationSeconds / 60;
    if (playerStats.pentaKills > 0) return { label: `PENTAKILL ${playerStats.pentaKills > 1 ? `x${playerStats.pentaKills}` : ''}`, icon: <Sparkles className="h-3 w-3 mr-1"/>, className: "border-purple-500 text-purple-300 bg-purple-900/60" };
    if (playerStats.quadraKills > 0) return { label: "QUADRA KILL", icon: <Star className="h-3 w-3 mr-1"/>, className: "border-orange-500 text-orange-300 bg-orange-900/60" };
    if (playerStats.tripleKills > 0) return { label: "TRIPLE KILL", icon: <Trophy className="h-3 w-3 mr-1"/>, className: "border-yellow-500 text-yellow-300 bg-yellow-900/60" };
    if ((playerStats.turretKills && playerStats.turretKills >= 3) || (playerStats.damageDealtToTurrets && playerStats.damageDealtToTurrets > 12000)) return { label: "TURRET SHREDDER", icon: <TowerControl className="h-3 w-3 mr-1"/>, className: "border-cyan-500 text-cyan-300 bg-cyan-900/60", tooltip: `Destroyed ${playerStats.turretKills || 0} turrets, ${ ((playerStats.damageDealtToTurrets ?? 0) / 1000).toFixed(1)}k turret damage` };
    if (playerStats.objectivesStolen && playerStats.objectivesStolen > 0) return { label: `OBJECTIVE STEAL${playerStats.objectivesStolen > 1 ? 'S' : ''} x${playerStats.objectivesStolen}`, icon: <Mountain className="h-3 w-3 mr-1"/>, className: "border-lime-500 text-lime-300 bg-lime-900/60" };
    if (playerStats.firstBloodKill) return { label: "FIRST BLOOD", icon: <Swords className="h-3 w-3 mr-1 text-red-400"/>, className: "border-red-600 text-red-200 bg-red-900/60" };
    if (gameDurationMinutes > 0 && (playerStats.visionScore ?? 0) / gameDurationMinutes >= 2.5) return { label: "VISION DOMINATOR", icon: <Eye className="h-3 w-3 mr-1"/>, className: "border-teal-500 text-teal-300 bg-teal-900/60", tooltip: `Vision Score/Min: ${((playerStats.visionScore ?? 0) / gameDurationMinutes).toFixed(1)}` };
    return null;
}

interface CircularProgressScoreProps { score: number; isRemakeDisplay: boolean; size?: number; strokeWidth?: number; hideLabel?: boolean; }
const CircularProgressScore: React.FC<CircularProgressScoreProps> = ({ score, isRemakeDisplay, size = 50, strokeWidth = 4, hideLabel = false }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = isRemakeDisplay ? circumference : circumference - (score / 100) * circumference;
  const getPerformanceColorClass = (s: number) => {
    if (isRemakeDisplay) return "stroke-slate-500";
    if (s >= 85) return "stroke-purple-500"; if (s >= 70) return "stroke-sky-500";
    if (s >= 55) return "stroke-emerald-500"; if (s >= 40) return "stroke-yellow-500";
    return "stroke-red-500";
  };
  const getPerformanceTextColorClass = (s: number) => {
    if (isRemakeDisplay) return "fill-slate-400";
    if (s >= 85) return "fill-purple-300"; if (s >= 70) return "fill-sky-300";
    if (s >= 55) return "fill-emerald-300"; if (s >= 40) return "fill-yellow-300";
    return "fill-red-300";
  };
  return (
    <div className="flex flex-col items-center justify-center h-full" title={isRemakeDisplay ? "Performance N/A (Remake)" : `Performance Score: ${score}/100`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle className="text-slate-700" strokeWidth={strokeWidth} stroke="currentColor" fill="transparent" r={radius} cx={size / 2} cy={size / 2} />
        <circle className={getPerformanceColorClass(score)} strokeWidth={strokeWidth} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" stroke="currentColor" fill="transparent" r={radius} cx={size / 2} cy={size / 2} />
        <text x="50%" y="50%" dy=".3em" textAnchor="middle" className={`text-base font-semibold ${getPerformanceTextColorClass(score)} rotate-90 origin-center`} style={{ fontSize: size < 40 ? '10px' : '1rem' }} >
          {isRemakeDisplay ? "N/A" : score}
        </text>
      </svg>
      {!isRemakeDisplay && !hideLabel && <span className="text-[10px] text-slate-400 mt-1">Score</span>}
    </div>
  );
};

interface DetailedRuneTooltipProps {
  runes: ResolvedParticipantRunes | null;
  visible: boolean;
  position: { top: number; left: number };
  currentPatchVersion: string;
  runeTreeData?: DDragonRuneTree[];
}
const DetailedRuneTooltipContent: React.FC<DetailedRuneTooltipProps> = ({ runes, visible, position, currentPatchVersion, runeTreeData }) => {
  if (!visible || !runes) return null;

  const renderRune = (rune: DDragonRune | undefined, defaultName: string, index: number) => {
    const key = rune ? `${rune.id}-${index}` : `${defaultName}-${index}`;
    if (!rune) {
      return ( <div key={key} className="flex items-center gap-2 py-0.5"> <div className="w-[20px] h-[20px] bg-slate-700 rounded-sm animate-pulse"></div> <span className="text-xs text-slate-500 italic">{defaultName} (N/A)</span> </div> );
    }
    return (
      <div key={key} className="flex items-center gap-2 py-0.5">
        <Image
            src={getRuneOrTreeIconUrl(rune.id, currentPatchVersion, runeTreeData)}
            alt={rune.name}
            width={20} height={20}
            className="rounded-sm bg-black/40"
            onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/20x20/1f2937/374151?text=R"; }} />
        <span className="text-xs text-slate-200">{rune.name}</span>
      </div>
    );
  };

  return (
    <div
      className="absolute z-50 p-3 bg-slate-900/95 border border-slate-700 rounded-lg shadow-xl w-72 text-sm backdrop-blur-sm"
      style={{ top: position.top, left: position.left, transform: 'translateY(-100%) translateX(-50%)' }}
    >
      {runes.keystone && (
        <div className="mb-2 pb-1.5 border-b border-slate-700">
          <p className="text-xs font-semibold text-purple-400 mb-1">{runes.primaryTreeName || 'Keystone'}</p>
          {renderRune(runes.keystone, "Keystone", 0)}
        </div>
      )}
      <div className="mb-2 pb-1.5 border-b border-slate-700">
        <p className="text-xs font-semibold text-sky-400 mb-1">{runes.primaryTreeName || 'Primary Path'}</p>
        {runes.primaryRunes.map((rune, index) => renderRune(rune, `Primary ${index + 1}`, index))}
      </div>
      {runes.secondaryRunes.length > 0 && (
        <div className="pb-1.5">
          <p className="text-xs font-semibold text-emerald-400 mb-1">{runes.secondaryTreeName || 'Secondary Path'}</p>
          {runes.secondaryRunes.map((rune, index) => renderRune(rune, `Secondary ${index + 1}`, index))}
        </div>
      )}
    </div>
  );
};


export function ClassicMatchDetails({
  matchDetails, searchedPlayerPuuid, currentPatchVersion,
  summonerSpellData, runeTreeData, championData, itemData,
  gameModeMap = defaultQueueIdToName,
  platformId
}: ClassicMatchDetailsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("details");
  const [runeTooltipData, setRuneTooltipData] = useState<ResolvedParticipantRunes | null>(null);
  const [isRuneTooltipVisible, setIsRuneTooltipVisible] = useState(false);
  const [runeTooltipPosition, setRuneTooltipPosition] = useState({ top: 0, left: 0 });
  const runeHoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);


  const searchedPlayerStats = useMemo(() => {
    return matchDetails.info?.participants?.find((p: MatchParticipantStats) => p.puuid === searchedPlayerPuuid);
  }, [matchDetails.info?.participants, searchedPlayerPuuid]);

  const isGameRemake = useMemo(() => {
    return matchDetails.info?.gameDuration !== undefined && matchDetails.info.gameDuration < 300 &&
           matchDetails.info.participants?.some((p: MatchParticipantStats) => p.gameEndedInEarlySurrender === true)
           ? true : false;
  }, [matchDetails.info?.participants, matchDetails.info?.gameDuration]);


  const { teamAverageScores, teamPerformanceTag } = useMemo(() => {
    if (!matchDetails.info?.participants || !matchDetails.info.teams || isGameRemake) {
      return { teamAverageScores: {}, teamPerformanceTag: null };
    }
    const scoresByTeam: Record<number, number[]> = { 100: [], 200: [] };
    matchDetails.info.participants.forEach(p => {
      const pTeam = matchDetails.info.teams.find(t => t.teamId === p.teamId);
      const pTeamTotalKills = pTeam?.objectives.champion.kills ?? 0;
      const score = calculatePerformanceScore(p, pTeamTotalKills, matchDetails.info.gameDuration, isGameRemake);
      if (p.teamId === 100 || p.teamId === 200) {
        scoresByTeam[p.teamId].push(score);
      }
    });
    const avgScores: Record<number, number> = {};
    if (scoresByTeam[100].length > 0) { avgScores[100] = scoresByTeam[100].reduce((a, b) => a + b, 0) / scoresByTeam[100].length; }
    if (scoresByTeam[200].length > 0) { avgScores[200] = scoresByTeam[200].reduce((a, b) => a + b, 0) / scoresByTeam[200].length; }
    let tag: string | null = null;
    if (searchedPlayerStats) {
        const searchedPlayerTeamId = searchedPlayerStats.teamId;
        const opponentTeamId = searchedPlayerTeamId === 100 ? 200 : 100;
        const searchedPlayerTeamAvg = avgScores[searchedPlayerTeamId] || 0;
        const opponentTeamAvg = avgScores[opponentTeamId] || 0;
        if (searchedPlayerTeamAvg > opponentTeamAvg + 7) tag = "Better Team";
        else if (opponentTeamAvg > searchedPlayerTeamAvg + 7) tag = "Worse Team";
        else if (searchedPlayerTeamAvg > 0 || opponentTeamAvg > 0) tag = "Even Match";
    }
    return { teamAverageScores: avgScores, teamPerformanceTag: tag };
  }, [matchDetails.info, isGameRemake, searchedPlayerStats]);

  if (!searchedPlayerStats || !matchDetails.info) {
    return ( <Alert variant="destructive" className="mb-3"> <ShieldAlert className="h-4 w-4" /> <AlertTitle>Player or Match Data Error</AlertTitle> <AlertDescription>Searched player's data or essential match details not found.</AlertDescription> </Alert> );
  }

  const { info } = matchDetails;
  const player = searchedPlayerStats;

  const playerTeamDto = info.teams.find(team => team.teamId === player.teamId);
  const teamTotalKills = playerTeamDto?.objectives.champion.kills ?? 0;

  const itemsRow1 = [player.item0, player.item1, player.item2, player.item6];
  const itemsRow2 = [player.item3, player.item4, player.item5];

  const primaryRuneStyleDto = player.perks?.styles?.find((s: PerkStyleDto) => s.description === "primaryStyle");
  const keystoneId = primaryRuneStyleDto?.selections?.[0]?.perk;
  const secondaryRuneTreeStyleDto = player.perks?.styles?.find((s: PerkStyleDto) => s.description === "subStyle");
  const secondaryTreeId = secondaryRuneTreeStyleDto?.style;
  const gameEndTime = info.gameEndTimestamp || (info.gameCreation + info.gameDuration * 1000);
  const gameModeName = gameModeMap[info.queueId] || info.gameMode?.replace(/_/g, ' ') || "Unknown Mode";

  let outcomeBorderColor = 'border-slate-500 dark:border-slate-400';
  let outcomeBgGradient = "from-slate-800/20 via-slate-900/30 to-slate-950/50";
  let outcomeText = "Remake";
  let outcomeBadgeVariant: "default" | "destructive" | "secondary" = "secondary";
  let outcomeBadgeBg = "bg-slate-500";

  if (!isGameRemake) {
    if (player.win) {
      outcomeBorderColor = 'border-blue-600 dark:border-blue-500';
      outcomeBgGradient = "from-blue-900/20 via-slate-900/30 to-slate-950/50";
      outcomeText = "VICTORY";
      outcomeBadgeVariant = "default";
      outcomeBadgeBg = "bg-blue-500";
    } else {
      outcomeBorderColor = 'border-red-600 dark:border-red-500';
      outcomeBgGradient = "from-red-900/20 via-slate-900/30 to-slate-950/50";
      outcomeText = "DEFEAT";
      outcomeBadgeVariant = "destructive";
      outcomeBadgeBg = "bg-red-500";
    }
  } else {
      outcomeText = "Remake";
      outcomeBadgeVariant = "secondary";
      outcomeBadgeBg = "bg-slate-500";
      outcomeBorderColor = 'border-slate-500 dark:border-slate-400';
      outcomeBgGradient = "from-slate-800/20 via-slate-900/30 to-slate-950/50";
  }


  const performanceScoreForSearchedPlayer = useMemo(() =>
    calculatePerformanceScore(player, teamTotalKills, info.gameDuration, isGameRemake),
  [player, teamTotalKills, info.gameDuration, isGameRemake]);

  const spell1Details = useMemo(() => getSummonerSpellDetails(player.summoner1Id, currentPatchVersion, summonerSpellData), [player.summoner1Id, currentPatchVersion, summonerSpellData]);
  const spell2Details = useMemo(() => getSummonerSpellDetails(player.summoner2Id, currentPatchVersion, summonerSpellData), [player.summoner2Id, currentPatchVersion, summonerSpellData]);

  const gameDurationMinutes = info.gameDuration / 60;
  const csPerMinute = gameDurationMinutes > 0 ? ((player.totalMinionsKilled + player.neutralMinionsKilled) / gameDurationMinutes).toFixed(1) : "0.0";

  const highlightTag = useMemo(() => getHighlightTag(player, info.gameDuration, isGameRemake), [player, info.gameDuration, isGameRemake]);

  const handleDetailedRuneHoverEnter = (event: React.MouseEvent<HTMLDivElement>, participantPerks?: PerksDto) => {
    if (runeHoverTimeoutRef.current) clearTimeout(runeHoverTimeoutRef.current);
    if (!participantPerks || !runeTreeData) {
        setRuneTooltipData(null);
        setIsRuneTooltipVisible(false);
        return;
    }
    const primaryStyleDto = participantPerks.styles?.find(s => s.description === "primaryStyle");
    const subStyleDto = participantPerks.styles?.find(s => s.description === "subStyle");
    if (!primaryStyleDto) {
        setRuneTooltipData(null);
        setIsRuneTooltipVisible(false);
        return;
    }
    const primaryTree = findRuneTreeById(runeTreeData, primaryStyleDto.style);
    const secondaryTree = subStyleDto ? findRuneTreeById(runeTreeData, subStyleDto.style) : undefined;
    const resolvedRunes: ResolvedParticipantRunes = {
        keystone: undefined, primaryRunes: [], secondaryRunes: [],
        primaryTreeName: primaryTree?.name, secondaryTreeName: secondaryTree?.name,
        statPerks: participantPerks.statPerks
    };
    if (primaryStyleDto.selections && primaryTree) {
        resolvedRunes.keystone = findRuneById(primaryTree, primaryStyleDto.selections[0]?.perk);
        resolvedRunes.primaryRunes = primaryStyleDto.selections.slice(1, 4).map(sel => findRuneById(primaryTree, sel.perk));
    }
    if (subStyleDto?.selections && secondaryTree) {
        resolvedRunes.secondaryRunes = subStyleDto.selections.slice(0, 2).map(sel => findRuneById(secondaryTree, sel.perk));
    }
    setRuneTooltipData(resolvedRunes);
    const rect = event.currentTarget.getBoundingClientRect();
    setRuneTooltipPosition({ top: rect.top + window.scrollY - 10, left: rect.left + window.scrollX + (rect.width / 2) });
    setIsRuneTooltipVisible(true);
  };

  const handleDetailedRuneHoverLeave = () => {
    runeHoverTimeoutRef.current = setTimeout(() => { setIsRuneTooltipVisible(false); }, 200);
  };
  const handleRuneTooltipMouseEnter = () => { if (runeHoverTimeoutRef.current) clearTimeout(runeHoverTimeoutRef.current); };
  const handleRuneTooltipMouseLeave = () => { setIsRuneTooltipVisible(false); setRuneTooltipData(null); };

  const tabs = [
    { id: "details", label: "Overview", icon: <BarChartHorizontalBig className="h-4 w-4 mr-1.5" /> },
    { id: "runes", label: "Runes", icon: <BookOpen className="h-4 w-4 mr-1.5" /> },
    { id: "spells", label: "Spells Casted", icon: <ZapIcon className="h-4 w-4 mr-1.5" /> },
  ];

  const searchedPlayerDisplayRemake = isGameRemake || (player.gameEndedInEarlySurrender ?? false);


  return (
    <TooltipProvider delayDuration={100}>
      <>
        <Collapsible
            open={isOpen}
            onOpenChange={setIsOpen}
            className={`match-card-classic mb-3 shadow-lg rounded-lg overflow-hidden bg-slate-900 text-gray-300 border border-slate-700/50 border-l-4 ${outcomeBorderColor}`}
        >
          <CollapsibleTrigger asChild><div className={`w-full block hover:brightness-125 transition-all cursor-pointer bg-gradient-to-r ${outcomeBgGradient}`} onClick={(e) => { if ((e.target as HTMLElement).closest('button, a, [data-state]')) return; setIsOpen(!isOpen); }}>
              <div className="p-3">
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">

                  <div className={`flex flex-col items-center justify-center text-center w-[85px] shrink-0 p-2 rounded-md ${isGameRemake ? 'bg-slate-700/30' : (player.win ? 'bg-blue-950/20' : 'bg-red-950/20')}`}>
                    <Badge variant={outcomeBadgeVariant} className={`font-bold text-xs px-2 py-0.5 ${outcomeBadgeBg} text-white shadow-sm`}>
                      {outcomeText}
                    </Badge>
                    <div className="text-xs font-medium text-gray-300 mt-1 uppercase truncate w-full" title={gameModeName}>{gameModeName}</div>
                    <div className="text-[10px] text-gray-400">{formatGameDuration(info.gameDuration)}</div>
                    <div className="text-[10px] text-gray-400">{timeAgo(gameEndTime)}</div>
                  </div>

                  <div className="flex flex-col items-center shrink-0">
                    <Tooltip>
                        <TooltipTrigger asChild><Avatar className="h-12 w-12 sm:h-14 sm:w-14 border-2 border-slate-600 rounded-md">
                                <AvatarImage src={getChampionSquareAssetUrl(player.championName, currentPatchVersion, championData)} alt={player.championName || 'Champion'} />
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

                  <div className="flex-grow min-w-0 px-1 sm:px-2 flex flex-col justify-center">
                    <div className="flex items-baseline gap-x-1 sm:gap-x-1.5">
                        <div className="flex items-baseline gap-0.5 text-sm sm:text-base whitespace-nowrap">
                            <span className="font-bold text-gray-100">{player.kills}</span><span className="text-gray-500 text-xs">/</span>
                            <span className="font-bold text-red-400">{player.deaths}</span><span className="text-gray-500 text-xs">/</span>
                            <span className="font-bold text-gray-100">{player.assists}</span>
                        </div>
                        <div className="border-l border-slate-600 h-4 self-center mx-1 sm:mx-1.5"></div>
                        <p className="text-sm sm:text-base text-gray-300 whitespace-nowrap">
                            {player.totalMinionsKilled + player.neutralMinionsKilled} CS
                            <span className="text-slate-400 text-xs"> ({csPerMinute}/min)</span>
                        </p>
                    </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1 justify-start">
                        {highlightTag && (
                            <Tooltip>
                                <TooltipTrigger asChild><Badge variant="outline" className={`text-xs py-0.5 px-1.5 ${highlightTag.className}`}>
                                        {highlightTag.icon}
                                        {highlightTag.label}
                                    </Badge></TooltipTrigger>
                                {highlightTag.tooltip && <TooltipContent className="bg-black text-white border-slate-700 text-xs p-1.5 rounded-md shadow-lg"><p>{highlightTag.tooltip}</p></TooltipContent>}
                            </Tooltip>
                        )}
                        {!isGameRemake && teamPerformanceTag && (
                            <Badge
                                variant={teamPerformanceTag === "Better Team" ? "default" : (teamPerformanceTag === "Worse Team" ? "destructive" : "secondary")}
                                className={`text-xs py-0.5 px-1.5
                                    ${teamPerformanceTag === "Better Team" ? "bg-emerald-600/80 border-emerald-500 text-emerald-100" :
                                      teamPerformanceTag === "Worse Team" ? "bg-red-700/70 border-red-600 text-red-100" :
                                      "bg-slate-600/70 border-slate-500 text-slate-100"}`}
                            >
                                <Scale className="h-3 w-3 mr-1"/>{teamPerformanceTag}
                            </Badge>
                        )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 p-2 bg-slate-800/60 rounded-md shadow-inner shrink-0">
                    <div className="flex flex-col gap-1">
                        {spell1Details ? ( <Tooltip>
                            <TooltipTrigger asChild><Avatar className="h-6 w-6 rounded-sm bg-slate-700">
                                <AvatarImage src={spell1Details.imageUrl} alt={spell1Details.name} />
                            </Avatar></TooltipTrigger>
                             <TooltipContent className="bg-black text-white border-slate-700 text-xs p-1.5 rounded-md shadow-lg max-w-xs"> <p className="font-semibold mb-0.5">{spell1Details.name}</p> <p className="text-slate-300" dangerouslySetInnerHTML={{ __html: spell1Details.description }}/> </TooltipContent> </Tooltip> )
                             : (<Avatar className="h-6 w-6 rounded-sm bg-slate-700 flex items-center justify-center"><CircleSlash className="h-4 w-4 text-slate-500" /></Avatar>) }
                        {spell2Details ? ( <Tooltip>
                            <TooltipTrigger asChild><Avatar className="h-6 w-6 rounded-sm bg-slate-700">
                                <AvatarImage src={spell2Details.imageUrl} alt={spell2Details.name} />
                            </Avatar></TooltipTrigger>
                             <TooltipContent className="bg-black text-white border-slate-700 text-xs p-1.5 rounded-md shadow-lg max-w-xs"> <p className="font-semibold mb-0.5">{spell2Details.name}</p> <p className="text-slate-300" dangerouslySetInnerHTML={{ __html: spell2Details.description }}/> </TooltipContent> </Tooltip> )
                             : (<Avatar className="h-6 w-6 rounded-sm bg-slate-700 flex items-center justify-center"><CircleSlash className="h-4 w-4 text-slate-500" /></Avatar>) }
                    </div>
                    <div className="flex flex-col items-center gap-1 cursor-default" onMouseEnter={(e) => handleDetailedRuneHoverEnter(e, player.perks)} onMouseLeave={handleDetailedRuneHoverLeave} >
                        {keystoneId && <Avatar className="h-6 w-6 rounded-full border border-yellow-600/50 bg-black/30"> <AvatarImage src={getRuneOrTreeIconUrl(keystoneId, currentPatchVersion, runeTreeData)} /> </Avatar> }
                        {secondaryTreeId && <Avatar className="h-6 w-6 rounded-sm bg-black/30"> <AvatarImage src={getRuneOrTreeIconUrl(secondaryTreeId, currentPatchVersion, runeTreeData, true)} /> </Avatar> }
                    </div>
                    <div className="border-l border-slate-600/70 h-12 self-stretch mx-1.5"></div>
                    <div className="flex flex-col gap-0.5">
                        <div className="flex gap-0.5">
                            {itemsRow1.map((itemId, idx) => {
                                const imageUrl = getItemImageUrl(itemId, currentPatchVersion);
                                const itemName = getItemName(itemId, itemData);
                                return (
                                <Tooltip key={`item-row1-${idx}-${itemId}`}>
                                    <TooltipTrigger asChild><Avatar className="h-6 w-6 rounded-sm bg-slate-700">
                                    {imageUrl ? <AvatarImage src={imageUrl} alt={itemName} /> : <div className="flex h-full w-full items-center justify-center"><CircleSlash className="h-4 w-4 text-slate-500" /></div> }
                                    </Avatar></TooltipTrigger>
                                    <TooltipContent className="bg-black text-white border-slate-700 text-xs p-1.5 rounded-md shadow-lg max-w-[200px]"> <p className="font-semibold">{itemName}</p> </TooltipContent>
                                </Tooltip>
                                );
                            })}
                        </div>
                        <div className="flex gap-0.5">
                            {itemsRow2.map((itemId, idx) => {
                                const imageUrl = getItemImageUrl(itemId, currentPatchVersion);
                                const itemName = getItemName(itemId, itemData);
                                return (
                                <Tooltip key={`item-row2-${idx}-${itemId}`}>
                                    <TooltipTrigger asChild><Avatar className="h-6 w-6 rounded-sm bg-slate-700">
                                    {imageUrl ? <AvatarImage src={imageUrl} alt={itemName} /> : <div className="flex h-full w-full items-center justify-center"><CircleSlash className="h-4 w-4 text-slate-500" /></div> }
                                    </Avatar></TooltipTrigger>
                                    <TooltipContent className="bg-black text-white border-slate-700 text-xs p-1.5 rounded-md shadow-lg max-w-[200px]"> <p className="font-semibold">{itemName}</p> </TooltipContent>
                                </Tooltip>
                                );
                            })}
                            {itemsRow2.length < 3 && Array(3 - itemsRow2.length).fill(0).map((_, emptyIdx) => (
                                <Avatar key={`empty-item-${emptyIdx}`} className="h-6 w-6 rounded-sm bg-slate-800/50 flex items-center justify-center">
                                    <CircleSlash className="h-4 w-4 text-slate-600" />
                                </Avatar>
                            ))}
                        </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-center shrink-0 w-16 md:w-20 ml-auto md:ml-2">
                       <CircularProgressScore score={performanceScoreForSearchedPlayer} isRemakeDisplay={searchedPlayerDisplayRemake} size={48} strokeWidth={4}/>
                  </div>

                  <div className="flex items-center pl-1 sm:pl-2 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8 data-[state=open]:bg-slate-700 hover:bg-slate-600 rounded-full text-gray-400 hover:text-gray-200">
                      {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>
            </div></CollapsibleTrigger>
          <CollapsibleContent>
            <Separator className="my-0 bg-slate-700" />
            <div className="bg-slate-800/50 border-b border-slate-700 flex px-2 pt-1">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center text-xs sm:text-sm font-medium px-3 py-2 rounded-t-md mr-1 transition-colors
                                ${activeTab === tab.id
                                    ? 'bg-slate-700/70 text-purple-300 border-b-2 border-purple-400'
                                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-700/40'}`}
                    >
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            <CardContent className="p-3 sm:p-4 text-xs sm:text-sm bg-slate-900/70 rounded-b-md min-h-[200px]">
                {activeTab === "details" && (
                    <div className="space-y-3">
                        <div className="overflow-x-auto rounded-md border border-slate-700">
                            <Table className="text-[11px] sm:text-xs min-w-[700px] sm:min-w-full">
                                <TableHeader className="bg-slate-800/60">
                                    <TableRow className="border-slate-700">
                                        <TableHead className="p-1.5 h-7 w-[160px] sm:w-[200px] text-gray-300">Player</TableHead>
                                        <TableHead className="p-1.5 h-7 text-center text-gray-300">Score</TableHead>
                                        <TableHead className="p-1.5 h-7 text-center text-gray-300">KDA</TableHead>
                                        <TableHead className="p-1.5 h-7 text-center text-gray-300">Dmg</TableHead>
                                        <TableHead className="p-1.5 h-7 text-center text-gray-300">Gold</TableHead>
                                        <TableHead className="p-1.5 h-7 text-center text-gray-300">CS</TableHead>
                                        <TableHead className="p-1.5 h-7 text-gray-300">Items</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {[100, 200].map(teamId => {
                                        const team = info.teams.find((t: TeamDto) => t.teamId === teamId);
                                        return (
                                        <React.Fragment key={`team-detail-${teamId}`}>
                                        <TableRow className="border-slate-700 bg-slate-700/20 hover:bg-slate-700/30">
                                            <TableCell colSpan={7} className="p-1.5 h-7">
                                            <div className="flex justify-between items-center">
                                                <h4 className={`text-xs font-bold ${teamId === 100 ? 'text-blue-400' : 'text-red-400'}`}>
                                                {teamId === 100 ? 'Blue Team' : 'Red Team'}
                                                {isGameRemake ? <span className="ml-2 text-xs font-normal text-gray-400">(Remake)</span> : (team && <span className="ml-2 text-xs font-normal text-gray-400">({team.win ? 'Victory' : 'Defeat'})</span>)}
                                                </h4>
                                                <span className="text-[10px] text-gray-400 flex items-center gap-2">
                                                <span><Swords className="inline h-3 w-3" /> {team?.objectives.champion.kills ?? 0}</span>
                                                <span><TowerControl className="inline h-3 w-3" /> {team?.objectives.tower.kills ?? 0}</span>
                                                <span><Flame className="inline h-3 w-3 text-orange-400" /> {team?.objectives.dragon.kills ?? 0}</span>
                                                <span><Mountain className="inline h-3 w-3 text-purple-400" /> {team?.objectives.baron.kills ?? 0}</span>
                                                </span>
                                            </div>
                                            </TableCell>
                                        </TableRow>
                                        {info.participants.filter((p: MatchParticipantStats) => p.teamId === teamId)
                                            .sort((a: MatchParticipantStats, b: MatchParticipantStats) => (a.teamPosition && b.teamPosition) ? (['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'].indexOf(a.teamPosition.toUpperCase()) - ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'].indexOf(b.teamPosition.toUpperCase())) : a.participantId - b.participantId)
                                            .map((p: MatchParticipantStats) => {
                                                const pGameName = p.riotIdGameName || p.summonerName;
                                                const pTagLine = p.riotIdTagline || "";
                                                const pProfileLink = pGameName && pTagLine ? `/profile/${platformId}/${encodeURIComponent(pGameName)}-${encodeURIComponent(pTagLine)}` : '#';

                                                const participantTeamDto = info.teams.find(team => team.teamId === p.teamId);
                                                const participantTeamTotalKills = participantTeamDto?.objectives.champion.kills ?? 0;
                                                const pScore = calculatePerformanceScore(p, participantTeamTotalKills, info.gameDuration, isGameRemake);
                                                const pDisplayRemake = isGameRemake || (p.gameEndedInEarlySurrender ?? false);

                                                return (
                                                    <TableRow key={p.puuid} className={`border-slate-700 ${p.puuid === searchedPlayerPuuid ? 'bg-blue-900/30 hover:bg-blue-900/40' : 'hover:bg-slate-700/30'}`}>
                                                        <TableCell className="p-1.5 flex items-center gap-1.5 whitespace-nowrap">
                                                        <Avatar className="h-6 w-6 rounded-sm"><AvatarImage src={getChampionSquareAssetUrl(p.championName, currentPatchVersion, championData)} /></Avatar>
                                                        <div className="flex flex-col leading-tight">
                                                            <Link href={pProfileLink} className="hover:text-purple-300 hover:underline transition-colors">
                                                                <span className="truncate font-medium max-w-[70px] sm:max-w-[110px] text-[11px] sm:text-xs text-gray-100" title={`${pGameName}${pTagLine ? `#${pTagLine}`: ''}`}>{pGameName}</span>
                                                            </Link>
                                                            {p.riotIdTagline && <span className="text-gray-500 text-[9px] sm:text-[10px]">#{p.riotIdTagline}</span>}
                                                        </div>
                                                        </TableCell>
                                                        <TableCell className="p-1.5 text-center">
                                                            <CircularProgressScore score={pScore} isRemakeDisplay={pDisplayRemake} size={28} strokeWidth={3} hideLabel={true} />
                                                        </TableCell>
                                                        <TableCell className="p-1.5 text-center text-gray-200">{p.kills}/{p.deaths}/{p.assists}</TableCell>
                                                        <TableCell className="p-1.5 text-center text-gray-200">{((p.totalDamageDealtToChampions ?? 0) / 1000).toFixed(1)}k</TableCell>
                                                        <TableCell className="p-1.5 text-center text-gray-200">{((p.goldEarned ?? 0) / 1000).toFixed(1)}k</TableCell>
                                                        <TableCell className="p-1.5 text-center text-gray-200">{(p.totalMinionsKilled ?? 0) + (p.neutralMinionsKilled ?? 0)}</TableCell>
                                                        <TableCell className="p-1.5">
                                                        <div className="flex gap-0.5">
                                                            {[p.item0, p.item1, p.item2, p.item3, p.item4, p.item5, p.item6].map((itemId, idx) => {
                                                                const imageUrl = getItemImageUrl(itemId, currentPatchVersion);
                                                                const itemName = getItemName(itemId, itemData);
                                                                return (
                                                                <Tooltip key={`pitem-${p.puuid}-${idx}-${itemId}`}>
                                                                    <TooltipTrigger asChild><Avatar className="h-5 w-5 rounded-sm bg-slate-800">
                                                                        {imageUrl ? <AvatarImage src={imageUrl} alt={itemName}/> : <div className="flex h-full w-full items-center justify-center"><CircleSlash className="h-3 w-3 text-slate-600" /></div> }
                                                                    </Avatar></TooltipTrigger>
                                                                    <TooltipContent className="bg-black text-white border-slate-700 text-xs p-1.5 rounded-md shadow-lg max-w-[200px]"><p className="font-semibold">{itemName}</p></TooltipContent>
                                                                </Tooltip>
                                                                );
                                                            })}
                                                        </div>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </React.Fragment>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                )}
                {activeTab === "runes" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4"> {/* Increased gap */}
                        {[100, 200].map(teamId => (
                            <div key={`runes-team-${teamId}`} className="space-y-4"> {/* Increased space between player cards */}
                                <h4 className={`text-base font-semibold mb-3 pb-1.5 border-b border-slate-600 ${teamId === 100 ? 'text-blue-400 border-blue-600' : 'text-red-400 border-red-600'}`}>
                                    {teamId === 100 ? 'Blue Team' : 'Red Team'}
                                </h4>
                                {info.participants.filter(p => p.teamId === teamId)
                                  .sort((a: MatchParticipantStats, b: MatchParticipantStats) => (a.teamPosition && b.teamPosition) ? (['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'].indexOf(a.teamPosition.toUpperCase()) - ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'].indexOf(b.teamPosition.toUpperCase())) : a.participantId - b.participantId)
                                  .map(p => {
                                    const primaryStyleDto = p.perks?.styles?.find(s => s.description === "primaryStyle");
                                    const subStyleDto = p.perks?.styles?.find(s => s.description === "subStyle");
                                    const primaryTree = primaryStyleDto ? findRuneTreeById(runeTreeData, primaryStyleDto.style) : undefined;
                                    const secondaryTree = subStyleDto ? findRuneTreeById(runeTreeData, subStyleDto.style) : undefined;
                                    const statPerks = p.perks?.statPerks;

                                    const keystoneRune = primaryTree && primaryStyleDto?.selections?.[0]?.perk ? findRuneById(primaryTree, primaryStyleDto.selections[0].perk) : undefined;
                                    const primaryRunesInSlot = primaryTree && primaryStyleDto?.selections?.slice(1).map(sel => findRuneById(primaryTree, sel.perk));
                                    const secondaryRunesInSlot = secondaryTree && subStyleDto?.selections?.map(sel => findRuneById(secondaryTree, sel.perk));

                                    return (
                                        <div key={p.puuid} className="p-3 bg-slate-800/50 rounded-lg border border-slate-700 shadow-lg">
                                            <div className="flex items-center gap-2 mb-3">
                                                <Avatar className="h-8 w-8 rounded-md border-2 border-slate-600"><AvatarImage src={getChampionSquareAssetUrl(p.championName, currentPatchVersion, championData)} /></Avatar>
                                                <span className="text-sm font-semibold text-slate-100 truncate">{p.riotIdGameName || p.summonerName}</span>
                                            </div>
                                            <div className="space-y-2">
                                                {/* Primary Rune Path */}
                                                {primaryTree && primaryStyleDto && (
                                                    <div className="flex items-center gap-2">
                                                        <Tooltip>
                                                            <TooltipTrigger asChild><Avatar className="h-7 w-7 bg-black/25 p-0.5 rounded-full border border-slate-500"><AvatarImage src={getRuneOrTreeIconUrl(primaryTree.id, currentPatchVersion, runeTreeData, true)} alt={primaryTree.name}/></Avatar></TooltipTrigger>
                                                            <TooltipContent><p>{primaryTree.name}</p></TooltipContent>
                                                        </Tooltip>
                                                        {keystoneRune && (
                                                            <Tooltip>
                                                                <TooltipTrigger asChild><Avatar className="h-8 w-8 bg-black/40 border-2 border-yellow-500/60 rounded-full p-0.5"><AvatarImage src={getRuneOrTreeIconUrl(keystoneRune.id, currentPatchVersion, runeTreeData)} alt={keystoneRune.name}/></Avatar></TooltipTrigger>
                                                                <TooltipContent><p className="font-semibold">{keystoneRune.name}</p><p className="text-xs text-slate-400 max-w-xs" dangerouslySetInnerHTML={{__html: keystoneRune.longDesc || keystoneRune.shortDesc || ""}}></p></TooltipContent>
                                                            </Tooltip>
                                                        )}
                                                        {primaryRunesInSlot?.map((rune, i) => rune ? (
                                                            <Tooltip key={`primary-${p.puuid}-${rune.id}-${i}`}>
                                                                <TooltipTrigger asChild><Avatar className="h-6 w-6 bg-black/30 rounded-md"><AvatarImage src={getRuneOrTreeIconUrl(rune.id, currentPatchVersion, runeTreeData)} alt={rune.name}/></Avatar></TooltipTrigger>
                                                                <TooltipContent><p className="font-semibold">{rune.name}</p><p className="text-xs text-slate-400 max-w-xs" dangerouslySetInnerHTML={{__html: rune.longDesc || rune.shortDesc || ""}}></p></TooltipContent>
                                                            </Tooltip>
                                                        ) : <div key={`primary-empty-${p.puuid}-${i}`} className="h-6 w-6 bg-slate-700/50 rounded-md animate-pulse" />)}
                                                    </div>
                                                )}
                                                {/* Secondary Rune Path */}
                                                {secondaryTree && subStyleDto && (
                                                    <div className="flex items-center gap-2">
                                                         <Tooltip>
                                                            <TooltipTrigger asChild><Avatar className="h-6 w-6 bg-black/25 p-0.5 rounded-full border border-slate-500"><AvatarImage src={getRuneOrTreeIconUrl(secondaryTree.id, currentPatchVersion, runeTreeData, true)} alt={secondaryTree.name}/></Avatar></TooltipTrigger>
                                                            <TooltipContent><p>{secondaryTree.name}</p></TooltipContent>
                                                        </Tooltip>
                                                        {secondaryRunesInSlot?.map((rune, i) => rune ? (
                                                            <Tooltip key={`secondary-${p.puuid}-${rune.id}-${i}`}>
                                                                <TooltipTrigger asChild><Avatar className="h-6 w-6 bg-black/30 rounded-md"><AvatarImage src={getRuneOrTreeIconUrl(rune.id, currentPatchVersion, runeTreeData)} alt={rune.name}/></Avatar></TooltipTrigger>
                                                                <TooltipContent><p className="font-semibold">{rune.name}</p><p className="text-xs text-slate-400 max-w-xs" dangerouslySetInnerHTML={{__html: rune.longDesc || rune.shortDesc || ""}}></p></TooltipContent>
                                                            </Tooltip>
                                                        ) : <div key={`secondary-empty-${p.puuid}-${i}`} className="h-6 w-6 bg-slate-700/50 rounded-md animate-pulse" />)}
                                                    </div>
                                                )}
                                                 {/* Stat Perks */}
                                                {statPerks && (
                                                    <div className="flex items-center gap-2 pt-1 mt-1 border-t border-slate-700/50">
                                                        <span className="text-xs text-slate-400 mr-1">Shards:</span>
                                                        {[statPerks.offense, statPerks.flex, statPerks.defense].map((perkId, i) => {
                                                            const type = i === 0 ? 'offense' : i === 1 ? 'flex' : 'defense';
                                                            return (
                                                                <Tooltip key={`stat-${p.puuid}-${perkId}-${i}`}>
                                                                    <TooltipTrigger asChild>
                                                                        <Avatar className="h-5 w-5 bg-slate-800/70 p-0.5 rounded-full">
                                                                            <AvatarImage src={getStatPerkIconUrl(perkId, type)} alt={getStatPerkName(perkId, type)} />
                                                                            <AvatarFallback className="text-[9px]">{getStatPerkName(perkId, type)[0]}</AvatarFallback>
                                                                        </Avatar>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent><p>{getStatPerkName(perkId, type)}</p></TooltipContent>
                                                                </Tooltip>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                )}
                {activeTab === "spells" && (
                     <div className="space-y-3 p-2 bg-slate-800/50 rounded-md border border-slate-700">
                        <h4 className="text-sm font-semibold text-slate-200 mb-2">Ability & Summoner Spell Casts for {player.championName}</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                            <div className="flex flex-col items-center p-2 bg-slate-700/50 rounded">
                                <span className="font-mono text-lg text-sky-300">{player.spell1Casts ?? 0}</span>
                                <span className="text-slate-400">Q Casts</span>
                            </div>
                            <div className="flex flex-col items-center p-2 bg-slate-700/50 rounded">
                                <span className="font-mono text-lg text-sky-300">{player.spell2Casts ?? 0}</span>
                                <span className="text-slate-400">W Casts</span>
                            </div>
                            <div className="flex flex-col items-center p-2 bg-slate-700/50 rounded">
                                <span className="font-mono text-lg text-sky-300">{player.spell3Casts ?? 0}</span>
                                <span className="text-slate-400">E Casts</span>
                            </div>
                            <div className="flex flex-col items-center p-2 bg-slate-700/50 rounded">
                                <span className="font-mono text-lg text-sky-300">{player.spell4Casts ?? 0}</span>
                                <span className="text-slate-400">R Casts</span>
                            </div>
                            {spell1Details && (
                                <div className="flex flex-col items-center p-2 bg-slate-700/50 rounded">
                                    <span className="font-mono text-lg text-yellow-400">{player.summoner1Casts ?? 0}</span>
                                    <span className="text-slate-400">{spell1Details.name} Casts</span>
                                </div>
                            )}
                            {spell2Details && (
                                <div className="flex flex-col items-center p-2 bg-slate-700/50 rounded">
                                    <span className="font-mono text-lg text-yellow-400">{player.summoner2Casts ?? 0}</span>
                                    <span className="text-slate-400">{spell2Details.name} Casts</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}
                {["laning", "build", "skills"].includes(activeTab) && (
                    <div className="text-slate-400 italic p-4 text-center">
                        Detailed {activeTab.replace('-', ' ')} information requires timeline data, which is not yet implemented for this view.
                    </div>
                )}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
        {isRuneTooltipVisible && runeTooltipData && (
            <div onMouseEnter={handleRuneTooltipMouseEnter} onMouseLeave={handleRuneTooltipMouseLeave}>
                <DetailedRuneTooltipContent
                    runes={runeTooltipData}
                    visible={isRuneTooltipVisible}
                    position={runeTooltipPosition}
                    currentPatchVersion={currentPatchVersion}
                    runeTreeData={runeTreeData}
                />
            </div>
        )}
      </>
    </TooltipProvider>
  );
}
