// app/MatchCard.tsx
'use client';

import { useTRPC } from '@/trpc/client';
import type { AppRouter } from '@/trpc/routers/_app';
import { useQuery } from '@tanstack/react-query';
import type { TRPCClientErrorLike } from '@trpc/client';
import { useMemo, useState } from 'react';

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import {
    ChevronDown, ChevronUp,
    Coins, Eye,
    Flame // Using Flame for Dragon
    ,
    Loader2,
    Mountain,
    ShieldAlert,
    Swords,
    TowerControl,
    Zap
} from 'lucide-react';

// --- Interfaces (Ensure these accurately match your backend tRPC procedure's return type and Data Dragon structures) ---

interface PerkStatsDto { defense: number; flex: number; offense: number; }
interface PerkStyleSelectionDto { perk: number; var1: number; var2: number; var3: number; }
interface PerkStyleDto { description: string; selections: PerkStyleSelectionDto[]; style: number; } // 'style' is the tree ID
interface PerksDto { statPerks: PerkStatsDto; styles: PerkStyleDto[]; }

interface MatchParticipantStats {
  participantId: number;
  puuid: string;
  riotIdGameName?: string;
  riotIdTagline?: string;
  summonerName: string;
  championName: string;
  championId: number; // Numeric ID from Riot API
  champLevel: number;
  teamId: number; // 100 for blue, 200 for red
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  item0: number; item1: number; item2: number; item3: number; item4: number; item5: number; item6: number; // Trinket
  summoner1Id: number; // Numeric ID
  summoner2Id: number; // Numeric ID
  goldEarned: number;
  goldSpent: number;
  totalMinionsKilled: number;
  neutralMinionsKilled: number;
  visionScore: number;
  wardsPlaced: number;
  visionWardsBoughtInGame?: number; // Control wards
  totalDamageDealtToChampions: number;
  damageDealtToObjectives: number;
  damageDealtToTurrets: number;
  pentaKills: number;
  quadraKills: number;
  tripleKills: number;
  doubleKills: number;
  perks?: PerksDto; // Contains rune information
  teamPosition?: string; // e.g., TOP, JUNGLE, MIDDLE, BOTTOM, UTILITY
  individualPosition?: string;
  timePlayed?: number;
  totalDamageTaken?: number;
  trueDamageDealtToChampions?: number;
}

interface BanDto { championId: number; pickTurn: number; }
interface ObjectiveDto { first: boolean; kills: number; }
interface ObjectivesDto {
  baron: ObjectiveDto; champion: ObjectiveDto; dragon: ObjectiveDto;
  inhibitor: ObjectiveDto; riftHerald: ObjectiveDto; tower: ObjectiveDto;
}
interface TeamDto {
  teamId: number;
  win: boolean;
  bans: BanDto[];
  objectives: ObjectivesDto;
}

interface MatchDetailsData {
  metadata: { matchId: string; participants: string[]; dataVersion: string; };
  info: {
    gameCreation: number; gameDuration: number; gameEndTimestamp?: number; gameId: number;
    gameMode: string; gameName: string; gameType: string; gameVersion: string;
    mapId: number; participants: MatchParticipantStats[]; platformId: string;
    queueId: number; teams: TeamDto[]; tournamentCode?: string;
  };
  fetchedFrom?: string;
}

// Data Dragon Types (to be passed as props)
interface DDragonSummonerSpell { id: string; name: string; description: string; key: string; image: { full: string; }; } // 'key' is numeric ID as string
interface DDragonRune { id: number; key: string; icon: string; name: string; shortDesc?: string; longDesc?: string; } // Individual rune
interface DDragonRuneTree { id: number; key: string; icon: string; name: string; slots: { runes: DDragonRune[] }[]; } // Rune tree from runesReforged.json
interface DDragonChampion { version: string; id: string; key: string; name: string; title: string; image: { full: string; }; } // 'id' is string key like "Aatrox", 'key' is numeric

interface MatchCardProps {
  matchId: string;
  platformId: string;
  searchedPlayerPuuid: string;
  currentPatchVersion: string;
  summonerSpellData?: Record<string, DDragonSummonerSpell>; // Keyed by spell's string ID (e.g., "SummonerFlash")
  runeTreeData?: DDragonRuneTree[]; // Array of all rune trees
  championData?: Record<string, DDragonChampion>; // Keyed by champion's string ID (e.g., "Aatrox")
  gameModeMap?: Record<number, string>; // Maps queueId to friendly name
}

const DDRAGON_BASE_URL = "https://ddragon.leagueoflegends.com/cdn";

// --- Helper Functions ---
function getItemImageUrl(itemId: number, patchVersion: string): string {
  if (!itemId || itemId === 0) return "https://placehold.co/32x32/2d3748/4A5568?text=%20"; // Placeholder for empty item slot
  return `${DDRAGON_BASE_URL}/${patchVersion}/img/item/${itemId}.png`;
}

function getChampionSquareAssetUrl(
  championApiName: string, // Name from Riot API (e.g., "Miss Fortune")
  patchVersion: string,
  champData?: MatchCardProps['championData'] // Data Dragon champion data, keyed by DDragon ID (e.g., "MissFortune")
): string {
  if (!championApiName) return "https://placehold.co/40x40/2d3748/4A5568?text=C";
  let ddragonChampionKey: string = championApiName.replace(/[^a-zA-Z0-9]/g, ''); // Default: format name to key

  if (champData) {
    // Find champion in DDragon data by matching 'name' or 'id' (DDragon's string key)
    const foundChamp = Object.values(champData).find(
      (c: DDragonChampion) => c.name === championApiName || c.id === championApiName || c.id === ddragonChampionKey
    );
    if (foundChamp) {
      ddragonChampionKey = foundChamp.id; // Use the DDragon ID (e.g., "MissFortune") for the image path
    }
  }
  return `${DDRAGON_BASE_URL}/${patchVersion}/img/champion/${ddragonChampionKey}.png`;
}

function getSummonerSpellImageUrl(
  spellApiId: number, // Numeric ID from ParticipantDto.summoner1Id/summoner2Id
  patchVersion: string,
  spellData?: MatchCardProps['summonerSpellData']
): string {
  if (spellData) {
    // Data Dragon's summoner.json data is keyed by spell string ID (e.g., "SummonerFlash"),
    // and each spell object has a numeric 'key' property (as a string).
    const foundSpell = Object.values(spellData).find((s: DDragonSummonerSpell) => parseInt(s.key) === spellApiId);
    if (foundSpell) {
      return `${DDRAGON_BASE_URL}/${patchVersion}/img/spell/${foundSpell.image.full}`;
    }
  }
  return `https://placehold.co/24x24/1a202c/2d3748?text=S${spellApiId}`;
}

function getRuneOrTreeIconUrl(
  id: number, // Can be a keystone rune ID or a secondary tree ID
  patchVersion: string,
  runeTrees?: MatchCardProps['runeTreeData']
): string {
  if (runeTrees) {
    // Check if it's a tree ID first
    const tree = runeTrees.find((t: DDragonRuneTree) => t.id === id);
    if (tree && tree.icon) {
      return `${DDRAGON_BASE_URL}/img/${tree.icon}`;
    }
    // If not a tree, search for it as an individual rune (keystone)
    for (const tree of runeTrees) {
      for (const slot of tree.slots) {
        const foundRune = slot.runes.find((r: DDragonRune) => r.id === id);
        if (foundRune && foundRune.icon) {
          return `${DDRAGON_BASE_URL}/img/${foundRune.icon}`;
        }
      }
    }
  }
  return `https://placehold.co/24x24/1a202c/2d3748?text=R${id}`;
}

function formatKDA(k: number, d: number, a: number): string {
  const kda = d === 0 ? (k + a).toFixed(1) : ((k + a) / d).toFixed(2);
  return `${kda} KDA`;
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
    return new Date(timestampMillis).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatGameDuration(durationInSeconds: number): string {
    const minutes = Math.floor(durationInSeconds / 60);
    const seconds = durationInSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

const defaultQueueIdToName: Record<number, string> = {
  400: "Normal Draft", 420: "Ranked Solo", 430: "Normal Blind", 440: "Ranked Flex",
  450: "ARAM", 700: "Clash", 1700: "Arena", 1900: "URF",
  // Add more from Data Dragon's queues.json as needed
};

export function MatchCard({
  matchId, platformId, searchedPlayerPuuid, currentPatchVersion,
  summonerSpellData, runeTreeData, championData, gameModeMap = defaultQueueIdToName
}: MatchCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const trpcClient = useTRPC();

  const matchDetailsQueryOptions = trpcClient.match.getMatchDetails.queryOptions(
    { matchId, platformId },
    { staleTime: 15 * 60 * 1000, gcTime: 60 * 60 * 1000, enabled: true }
  );

  const {
    data: matchDetails, // Type should be inferred as MatchDetailsData | undefined
    isLoading,
    isFetching,
    error,
  } = useQuery(matchDetailsQueryOptions);

  const typedError = error as TRPCClientErrorLike<AppRouter> | null;

  const searchedPlayerStats = useMemo(() => {
    if (!matchDetails?.info?.participants || !searchedPlayerPuuid) return null;
    return matchDetails.info.participants.find((p: MatchParticipantStats) => p.puuid === searchedPlayerPuuid);
  }, [matchDetails, searchedPlayerPuuid]);

  if (isLoading && !matchDetails) {
    return (
      <Card className="mb-3 animate-pulse bg-slate-200 dark:bg-slate-700/50 p-3 rounded-lg shadow-md">
        <div className="h-10 bg-slate-300 dark:bg-slate-600 rounded w-3/4 mb-2"></div>
        <div className="h-5 bg-slate-300 dark:bg-slate-600 rounded w-1/2"></div>
      </Card>
    );
  }
  if (typedError) {
    return (
      <Alert variant="destructive" className="mb-3"><ShieldAlert className="h-4 w-4" /><AlertTitle>Error: {matchId.substring(0,10)}...</AlertTitle><AlertDescription>{typedError.message}</AlertDescription></Alert>
    );
  }
  if (!matchDetails || !searchedPlayerStats) {
    return (
      <Card className="mb-3 p-3 rounded-lg shadow bg-white dark:bg-gray-800">
        <p>Match data not available or player ({searchedPlayerPuuid.substring(0,10)}...) not found in this match.</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">ID: {matchId}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">Fetched from: {matchDetails?.fetchedFrom || 'N/A'}</p>
      </Card>
    );
  }

  const player = searchedPlayerStats; // player is now MatchParticipantStats
  const { info } = matchDetails; // info is now MatchDetailsData['info']

  const items = [player.item0, player.item1, player.item2, player.item3, player.item4, player.item5];
  const trinket = player.item6;

  const primaryRuneStyleDto = player.perks?.styles.find((s: PerkStyleDto) => s.description === "primaryStyle");
  const keystoneId = primaryRuneStyleDto?.selections[0]?.perk;
  const secondaryRuneTreeStyleDto = player.perks?.styles.find((s: PerkStyleDto) => s.description === "subStyle");
  const secondaryTreeId = secondaryRuneTreeStyleDto?.style; // This is the ID of the secondary tree itself

  const gameEndTime = info.gameEndTimestamp || (info.gameCreation + info.gameDuration * 1000);
  const gameModeName = (gameModeMap && gameModeMap[info.queueId]) || info.gameMode.replace(/_/g, ' ') || "Unknown Mode";

  return (
    <TooltipProvider delayDuration={100}>
      <Card className={`mb-3 shadow-lg rounded-lg overflow-hidden border-l-4 ${player.win ? 'border-blue-600 dark:border-blue-500' : 'border-red-600 dark:border-red-500'} bg-white dark:bg-gray-800`}>
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild className="w-full">
            <div className="p-3 hover:bg-gray-50 dark:hover:bg-gray-700/70 transition-colors cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
              <div className="flex items-center gap-2 sm:gap-3">
                {/* Column 1: Game Info & Win/Loss */}
                <div className={`flex flex-col items-center justify-center text-center w-20 shrink-0 p-1.5 rounded-md ${player.win ? 'bg-blue-50 dark:bg-blue-900/30' : 'bg-red-50 dark:bg-red-900/30'}`}>
                  <Badge variant={player.win ? "default" : "destructive"} className={`font-bold text-xs px-2 py-0.5 ${player.win ? 'bg-blue-500' : 'bg-red-500'} text-white shadow-sm`}>
                    {player.win ? 'VICTORY' : 'DEFEAT'}
                  </Badge>
                  <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mt-1 uppercase truncate w-full" title={gameModeName}>{gameModeName}</div>
                  <div className="text-[10px] text-gray-500 dark:text-gray-400">{formatGameDuration(info.gameDuration)}</div>
                  <div className="text-[10px] text-gray-500 dark:text-gray-400">{timeAgo(gameEndTime)}</div>
                </div>

                {/* Column 2: Champion & Summoner Spells/Runes */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <Avatar className="h-12 w-12 sm:h-14 sm:w-14 border-2 border-gray-300 dark:border-gray-600 rounded-md">
                    <AvatarImage src={getChampionSquareAssetUrl(player.championName, currentPatchVersion, championData)} alt={player.championName} />
                    <AvatarFallback>{player.championName?.[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col gap-0.5">
                    <Avatar className="h-5 w-5 sm:h-6 sm:w-6 rounded-sm"><AvatarImage src={getSummonerSpellImageUrl(player.summoner1Id, currentPatchVersion, summonerSpellData)} alt="Summoner Spell 1" /></Avatar>
                    <Avatar className="h-5 w-5 sm:h-6 sm:w-6 rounded-sm"><AvatarImage src={getSummonerSpellImageUrl(player.summoner2Id, currentPatchVersion, summonerSpellData)} alt="Summoner Spell 2" /></Avatar>
                  </div>
                  {/* Runes Display */}
                  <div className="flex flex-col gap-0.5">
                    {keystoneId && <Avatar className="h-5 w-5 sm:h-6 sm:w-6 rounded-full border border-yellow-500/50"><AvatarImage src={getRuneOrTreeIconUrl(keystoneId, currentPatchVersion, runeTreeData)} alt="Keystone Rune" /></Avatar>}
                    {secondaryTreeId && <Avatar className="h-5 w-5 sm:h-6 sm:w-6 rounded-sm"><AvatarImage src={getRuneOrTreeIconUrl(secondaryTreeId, currentPatchVersion, runeTreeData)} alt="Secondary Tree" /></Avatar>}
                  </div>
                </div>

                {/* Column 3: KDA & Core Stats */}
                <div className="flex-grow min-w-0 px-1 sm:px-2">
                  <p className="font-semibold text-base sm:text-lg truncate" title={player.championName}>{player.championName}</p>
                  <div className="flex items-baseline gap-0.5 text-sm sm:text-base">
                    <span className="font-bold text-gray-800 dark:text-gray-100">{player.kills}</span><span className="text-gray-400 dark:text-gray-500 text-xs">/</span>
                    <span className="font-bold text-red-500 dark:text-red-400">{player.deaths}</span><span className="text-gray-400 dark:text-gray-500 text-xs">/</span>
                    <span className="font-bold text-gray-800 dark:text-gray-100">{player.assists}</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{formatKDA(player.kills,player.deaths,player.assists)}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
                    LvL {player.champLevel} <span className="text-gray-400 dark:text-gray-500">|</span> {player.totalMinionsKilled + player.neutralMinionsKilled} CS
                  </p>
                </div>

                {/* Column 4: Items */}
                <div className="hidden lg:flex flex-wrap items-center justify-end gap-0.5 w-40 shrink-0">
                  {items.map((itemId, idx) => (
                    <Tooltip key={`item-${idx}`}>
                      <TooltipTrigger asChild><Avatar className="h-7 w-7 rounded-sm"><AvatarImage src={getItemImageUrl(itemId, currentPatchVersion)} /></Avatar></TooltipTrigger>
                      <TooltipContent><p>Item ID: {itemId || 'Empty'}</p></TooltipContent>
                    </Tooltip>
                  ))}
                   <Tooltip>
                      <TooltipTrigger asChild><Avatar className="h-7 w-7 rounded-sm"><AvatarImage src={getItemImageUrl(trinket, currentPatchVersion)} /></Avatar></TooltipTrigger>
                      <TooltipContent><p>Trinket ID: {trinket || 'Empty'}</p></TooltipContent>
                    </Tooltip>
                </div>
                 {/* Column 5: Expand Icon */}
                <div className="flex items-center pl-1 sm:pl-2 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8 data-[state=open]:bg-slate-200 dark:data-[state=open]:bg-slate-700 rounded-full">
                    {isFetching && isOpen ? <Loader2 className="h-4 w-4 animate-spin" /> : (isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
                  </Button>
                </div>
              </div>
            </div>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <Separator className="my-0 dark:bg-gray-700" />
            <CardContent className="p-3 sm:p-4 space-y-3 text-xs sm:text-sm bg-slate-50 dark:bg-gray-800/70">
              {/* Searched Player's Detailed Stats */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-3 gap-y-1.5 mb-3 p-2 border rounded-md dark:border-gray-700">
                <div className="flex items-center gap-1" title="Total Damage Dealt to Champions"><Swords className="h-3.5 w-3.5 text-red-500" />Dmg to Champs: <span className="font-medium">{(player.totalDamageDealtToChampions / 1000).toFixed(1)}k</span></div>
                <div className="flex items-center gap-1" title="Vision Score"><Eye className="h-3.5 w-3.5 text-teal-500" />Vision: <span className="font-medium">{player.visionScore}</span></div>
                <div className="flex items-center gap-1" title="Gold Earned"><Coins className="h-3.5 w-3.5 text-yellow-500" />Gold: <span className="font-medium">{(player.goldEarned / 1000).toFixed(1)}k</span></div>
                <div className="flex items-center gap-1" title="Wards Placed"><Zap className="h-3.5 w-3.5 text-green-500" />Wards Placed: <span className="font-medium">{player.wardsPlaced}</span></div>
                <div className="flex items-center gap-1" title="Control Wards Bought"><Eye className="h-3.5 w-3.5 text-pink-500" />Ctrl Wards: <span className="font-medium">{player.visionWardsBoughtInGame || 0}</span></div>
                <div className="flex items-center gap-1" title="Damage to Objectives"><TowerControl className="h-3.5 w-3.5 text-orange-500" />Obj Dmg: <span className="font-medium">{(player.damageDealtToObjectives / 1000).toFixed(1)}k</span></div>
                {player.pentaKills > 0 && <div className="col-span-full sm:col-span-1"><Badge variant="destructive" className="bg-purple-600 text-white">PENTAKILL x{player.pentaKills}</Badge></div>}
                {player.quadraKills > 0 && player.pentaKills === 0 && <div className="col-span-full sm:col-span-1"><Badge variant="secondary" className="bg-orange-500 text-white">Quadra Kill x{player.quadraKills}</Badge></div>}
              </div>
              
              {/* Team Scoreboards */}
              {[100, 200].map(teamId => {
                const team = info.teams.find((t: TeamDto) => t.teamId === teamId);
                return (
                  <div key={teamId} className="mb-2 last:mb-0">
                    <div className="flex justify-between items-center mb-1.5 px-1">
                      <h4 className={`text-sm font-bold ${teamId === 100 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>
                        {teamId === 100 ? 'Blue Team' : 'Red Team'}
                        <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
                          (<Swords className="inline h-3 w-3" /> {team?.objectives.champion.kills || 0} |
                           <TowerControl className="inline h-3 w-3" /> {team?.objectives.tower.kills || 0} |
                           <Flame className="inline h-3 w-3 text-orange-500" /> {team?.objectives.dragon.kills || 0} |
                           <Mountain className="inline h-3 w-3 text-gray-500" /> {team?.objectives.baron.kills || 0})
                        </span>
                      </h4>
                      {team && <Badge variant={team.win ? "default" : "destructive"} className={`${team.win ? 'bg-green-600' : 'bg-red-600'} text-white text-[10px] px-1.5 py-0.5`}>{team.win ? 'VICTORY' : 'DEFEAT'}</Badge>}
                    </div>
                    <div className="overflow-x-auto rounded-md border dark:border-gray-700">
                      <Table className="text-[11px] sm:text-xs min-w-[600px] sm:min-w-full">
                        <TableHeader className="bg-slate-100 dark:bg-gray-700/50">
                          <TableRow className="dark:border-gray-600">
                            <TableHead className="p-1.5 h-7 w-[150px] sm:w-[200px]">Player</TableHead>
                            <TableHead className="p-1.5 h-7 text-center">KDA</TableHead>
                            <TableHead className="p-1.5 h-7 text-center">Dmg</TableHead>
                            <TableHead className="p-1.5 h-7 text-center">Gold</TableHead>
                            <TableHead className="p-1.5 h-7 text-center">CS</TableHead>
                            <TableHead className="p-1.5 h-7">Items</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {info.participants
                            .filter((p: MatchParticipantStats) => p.teamId === teamId)
                            .sort((a: MatchParticipantStats, b: MatchParticipantStats) => (a.teamPosition && b.teamPosition) ? (['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'].indexOf(a.teamPosition) - ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'].indexOf(b.teamPosition)) : a.participantId - b.participantId)
                            .map((p: MatchParticipantStats) => (
                              <TableRow key={p.puuid} className={`dark:border-gray-600 ${p.puuid === searchedPlayerPuuid ? 'bg-blue-100/70 dark:bg-blue-900/40' : 'odd:bg-white dark:odd:bg-gray-800 even:bg-slate-50 dark:even:bg-gray-800/50 hover:bg-slate-100 dark:hover:bg-gray-700'}`}>
                                <TableCell className="p-1.5 flex items-center gap-1.5 whitespace-nowrap">
                                  <Avatar className="h-6 w-6 rounded-sm"><AvatarImage src={getChampionSquareAssetUrl(p.championName, currentPatchVersion, championData)} alt={p.championName} /></Avatar>
                                  <div className="flex flex-col leading-tight">
                                    <span className="truncate font-medium max-w-[70px] sm:max-w-[110px] text-[10px] sm:text-xs" title={p.riotIdGameName || p.summonerName}>{p.riotIdGameName || p.summonerName}</span>
                                    {p.riotIdTagline && <span className="text-gray-500 dark:text-gray-400 text-[9px] sm:text-[10px]">#{p.riotIdTagline}</span>}
                                  </div>
                                </TableCell>
                                <TableCell className="p-1.5 text-center">{p.kills}/{p.deaths}/{p.assists}</TableCell>
                                <TableCell className="p-1.5 text-center">{(p.totalDamageDealtToChampions / 1000).toFixed(1)}k</TableCell>
                                <TableCell className="p-1.5 text-center">{(p.goldEarned / 1000).toFixed(1)}k</TableCell>
                                <TableCell className="p-1.5 text-center">{p.totalMinionsKilled + p.neutralMinionsKilled}</TableCell>
                                <TableCell className="p-1.5">
                                  <div className="flex gap-0.5">
                                    {[p.item0, p.item1, p.item2, p.item3, p.item4, p.item5, p.item6].map((itemId, idx) => (
                                      <Tooltip key={`pitem-${p.puuid}-${idx}`}>
                                        <TooltipTrigger asChild>
                                          <Avatar className="h-5 w-5 rounded-sm"><AvatarImage src={getItemImageUrl(itemId, currentPatchVersion)} alt={`Item ${idx}`} /></Avatar>
                                        </TooltipTrigger>
                                        <TooltipContent><p>Item ID: {itemId || 'Empty'}</p></TooltipContent>
                                      </Tooltip>
                                    ))}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    </TooltipProvider>
  );
}
