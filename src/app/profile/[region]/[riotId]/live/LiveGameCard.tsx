'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTRPC } from '@/trpc/client';
import type { AppRouter } from '@/trpc/routers/_app';
import type { DDragonChampion, DDragonDataBundle, DDragonRune, DDragonRuneTree, LeagueEntryDTO } from '@/types/ddragon';
import type { CurrentGameInfo, BannedChampion as SpectatorBannedChampion, Perks as SpectatorPerks, CurrentGameParticipant as SpectatorParticipant } from '@/types/spectatorV5';
import { useQuery } from '@tanstack/react-query';
import type { TRPCClientErrorLike } from '@trpc/client';
import { AlertTriangle, Ban, GripVertical, Loader2, MonitorOff, ShieldX, Users } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

// Dnd-kit imports
import {
    closestCenter,
    DndContext,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    rectSortingStrategy,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const COMPONENT_NAME = "LiveGameCard";

interface LiveGameCardProps {
  liveGameData: CurrentGameInfo | null | undefined;
  isLoading: boolean;
  error: TRPCClientErrorLike<AppRouter> | null;
  searchedPlayerPuuid: string;
  currentPatchVersion: string;
  ddragonData: DDragonDataBundle;
}

interface ResolvedParticipantRunes {
  keystone?: DDragonRune;
  primaryRunes: (DDragonRune | undefined)[];
  secondaryRunes: (DDragonRune | undefined)[];
  primaryTreeName?: string;
  secondaryTreeName?: string;
}

// --- Helper Functions ---
function formatGameLength(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

function getDDragonAssetUrl(path: string | undefined): string {
    if (!path) return "https://placehold.co/24x24/1f2937/374151?text=A"; // Placeholder for asset
    return `https://ddragon.leagueoflegends.com/cdn/img/${path}`;
}

function getChampionIconUrl(championNameId: string | undefined, patchVersion: string): string {
    if (!championNameId) return "https://placehold.co/72x72/1f2937/374151?text=C"; // Placeholder for champion
    return `https://ddragon.leagueoflegends.com/cdn/${patchVersion}/img/champion/${championNameId}.png`;
}

function getSummonerSpellIconUrl(spellId: number, spellData: DDragonDataBundle['summonerSpellData'], patchVersion: string): string {
    if (!spellData) return "https://placehold.co/28x28/1f2937/374151?text=S"; // Placeholder for spell
    const spell = Object.values(spellData).find(s => s.key === String(spellId));
    if (!spell) return "https://placehold.co/28x28/1f2937/374151?text=S"; // Placeholder if spell not found
    return `https://ddragon.leagueoflegends.com/cdn/${patchVersion}/img/spell/${spell.id}.png`;
}

function getRankedEmblemUrl(tier?: string): string {
  // This function should return a valid image path for ranked tiers.
  // For "Unranked", it's handled by not rendering an Image tag.
  const defaultUnrankedPath = "/images/ranked-emblems/Rank=Unranked.png"; // Path if you had a generic unranked image.
  if (!tier || tier.toLowerCase() === 'unranked' || tier.toLowerCase() === 'none') {
    // For unranked, we won't use this URL directly to render an image,
    // but it could be used as a fallback if needed elsewhere.
    return defaultUnrankedPath;
  }
  const formattedTier = tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase();
  const knownTiers = ["Iron", "Bronze", "Silver", "Gold", "Platinum", "Emerald", "Diamond", "Master", "Grandmaster", "Challenger"];
  if (knownTiers.includes(formattedTier)) {
    return `/images/ranked-emblems/Rank=${formattedTier}.png`;
  }
  return defaultUnrankedPath; // Fallback to a default path if tier is unknown
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

// --- Player Card Display Component ---
interface PlayerCardDisplayProps {
  participant: SpectatorParticipant;
  championDetails?: DDragonChampion;
  keystoneRune?: DDragonRune;
  secondaryTree?: DDragonRuneTree;
  rankedEntries?: LeagueEntryDTO[] | null;
  currentPatchVersion: string;
  ddragonData: DDragonDataBundle;
  isSearchedPlayer: boolean;
  platformId: string;
  onRuneHoverEnter: (event: React.MouseEvent<HTMLDivElement>, perks: SpectatorPerks) => void;
  onRuneHoverLeave: () => void;
  isArenaMode?: boolean;
}

const SortablePlayerCard: React.FC<PlayerCardDisplayProps & { id: string }> = (props) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({id: props.id, disabled: props.isArenaMode }); // Dragging disabled in Arena mode

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.8 : 1,
    zIndex: isDragging ? 100 : undefined,
    touchAction: props.isArenaMode ? 'auto' : 'none', // Allow touch interactions like scrolling in Arena mode cards
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...(props.isArenaMode ? {} : listeners)} >
      <PlayerCardDisplay {...props} />
    </div>
  );
};


const PlayerCardDisplay: React.FC<PlayerCardDisplayProps> = ({
  participant,
  championDetails,
  keystoneRune,
  secondaryTree,
  rankedEntries,
  currentPatchVersion,
  ddragonData,
  isSearchedPlayer,
  platformId,
  onRuneHoverEnter,
  onRuneHoverLeave,
  isArenaMode = false,
}) => {
  // Robust parsing of Riot ID and fallback to summonerName
  const gameNameFromRiotId = participant.riotId?.includes('#') ? participant.riotId.split('#')[0] : participant.riotId;
  const tagLineFromRiotId = participant.riotId?.includes('#') ? participant.riotId.split('#')[1] : '';

  const gameName = gameNameFromRiotId || participant.summonerName || 'Player';
  const tagLine = tagLineFromRiotId || ''; // Can be empty if no tagline
  const displayRiotId = tagLine ? `${gameName}#${tagLine}` : gameName;


  const teamColorClass = isArenaMode
    ? 'border-purple-400' // Arena teams get a purple border
    : (participant.teamId === 100 ? 'border-blue-500' : 'border-red-500');

  const searchedPlayerHighlight = isSearchedPlayer ? 'ring-2 ring-purple-500 shadow-purple-500/50' : 'hover:ring-1 hover:ring-slate-500';
  const runeIconStyle = "rounded-full bg-black/50 p-0.5 border border-slate-600 shadow-md";

  const soloDuoRank = rankedEntries?.find(entry => entry.queueType === "RANKED_SOLO_5x5");
  const profileLink = `/profile/${platformId}/${gameName}-${tagLine}`; // Ensure tagline is included if present

  const cardWidth = isArenaMode ? "flex-1 min-w-[150px] max-w-[170px]" : "w-[180px] md:w-[200px]";
  const imageSize = isArenaMode ? 52 : 72;
  const spellRuneSize = isArenaMode ? 20 : 28; // Used for spells and runes
  const rankedEmblemSize = isArenaMode ? 32 : 56;

  // Determine the fixed height for the rank info section
  const rankSectionHeightClass = isArenaMode ? 'h-[60px]' : 'h-[100px]';

  return (
    <div
      className={`player-card bg-slate-800/70 rounded-lg shadow-lg ${cardWidth} transition-all duration-200 ease-in-out ${searchedPlayerHighlight} flex flex-col ${!isArenaMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}`}
    >
      {/* Card Header (Drag handle or Arena color bar) */}
      {!isArenaMode && (
        <div
          className={`h-16 rounded-t-lg ${participant.teamId === 100 ? 'bg-blue-600/30' : 'bg-red-600/30'} flex items-center justify-center`}
        >
          <GripVertical size={20} className="text-slate-400/30" />
        </div>
      )}
      {isArenaMode && (
         <div className={`h-5 rounded-t-lg bg-purple-600/40 flex items-center justify-center`}></div>
      )}

      {/* Main Content Area */}
      <div className={`relative px-1.5 pb-1.5 ${isArenaMode ? '-mt-3' : '-mt-12'} flex flex-col items-center flex-grow`}>
        {/* Top section: Spells, Champion Icon, Runes/Spacer */}
        <div className="flex justify-around items-end w-full mb-1">
          {/* Left Column: Summoner Spells or Bot Spacer */}
          {!participant.bot ? (
            <div className="flex flex-col gap-0.5 self-center">
              <Image
                src={getSummonerSpellIconUrl(participant.spell1Id, ddragonData.summonerSpellData, currentPatchVersion)}
                alt="Spell 1" width={spellRuneSize} height={spellRuneSize} className="rounded border border-slate-900 shadow-sm"
                onError={(e) => { (e.target as HTMLImageElement).src = `https://placehold.co/${spellRuneSize}x${spellRuneSize}/1f2937/374151?text=S1`; }}/>
              <Image
                src={getSummonerSpellIconUrl(participant.spell2Id, ddragonData.summonerSpellData, currentPatchVersion)}
                alt="Spell 2" width={spellRuneSize} height={spellRuneSize} className="rounded border border-slate-900 shadow-sm"
                onError={(e) => { (e.target as HTMLImageElement).src = `https://placehold.co/${spellRuneSize}x${spellRuneSize}/1f2937/374151?text=S2`; }}/>
            </div>
          ) : (
            <div style={{ width: spellRuneSize + 2, height: (spellRuneSize * 2) + 2 }} className="self-center"></div> // Spacer for bot spells
          )}

          {/* Center Column: Champion Icon */}
          <div className="relative">
            <Image
              src={getChampionIconUrl(championDetails?.id, currentPatchVersion)}
              alt={championDetails?.name || 'Champion'}
              width={imageSize}
              height={imageSize}
              className={`rounded-full border-2 ${teamColorClass} shadow-lg bg-slate-900`}
              onError={(e) => { (e.target as HTMLImageElement).src = `https://placehold.co/${imageSize}x${imageSize}/1f2937/374151?text=C`; }}
            />
          </div>

          {/* Right Column: Runes (non-Arena) or Spacers */}
          <div
            className="flex flex-col items-center gap-0.5 self-center"
            onMouseEnter={(!isArenaMode && !participant.bot && participant.perks) ? (e) => participant.perks && onRuneHoverEnter(e, participant.perks) : undefined}
            onMouseLeave={(!isArenaMode && !participant.bot && participant.perks) ? onRuneHoverLeave : undefined}
            style={{ width: spellRuneSize + 4 }} // Fixed width for the column (+4 for padding/border consideration from runeIconStyle)
          >
            {!isArenaMode && !participant.bot && participant.perks ? (
              <>
                {keystoneRune ? (
                  <Image src={getDDragonAssetUrl(keystoneRune.icon)} alt={keystoneRune.name} width={spellRuneSize} height={spellRuneSize} className={runeIconStyle} title={keystoneRune.name} onError={(e) => { (e.target as HTMLImageElement).src = `https://placehold.co/${spellRuneSize}x${spellRuneSize}/1f2937/374151?text=R`; }} />
                ) : (
                  <div style={{ width: spellRuneSize, height: spellRuneSize }} className="rounded-full bg-black/20 p-0.5 border border-slate-700/40 shadow-inner"></div> // Dim placeholder for missing keystone
                )}
                {secondaryTree ? (
                  <Image src={getDDragonAssetUrl(secondaryTree.icon)} alt={secondaryTree.name} width={spellRuneSize} height={spellRuneSize} className={runeIconStyle} title={secondaryTree.name} onError={(e) => { (e.target as HTMLImageElement).src = `https://placehold.co/${spellRuneSize}x${spellRuneSize}/1f2937/374151?text=R`; }} />
                ) : (
                  <div style={{ width: spellRuneSize, height: spellRuneSize }} className="rounded-full bg-black/20 p-0.5 border border-slate-700/40 shadow-inner"></div> // Dim placeholder for missing secondary
                )}
              </>
            ) : (
              // Spacers for Arena, Bot, or no Perks to maintain height and structure
              <>
                <div style={{ width: spellRuneSize, height: spellRuneSize }}></div>
                <div style={{ width: spellRuneSize, height: spellRuneSize }}></div>
              </>
            )}
          </div>
        </div>

        {/* Bottom section: Name, Champion, Rank Info */}
        <div className="text-center w-full space-y-0.5 mt-0.5 flex-grow flex flex-col justify-between">
          {/* Name and Champion */}
          <div>
            <Link href={profileLink} className="hover:text-purple-400 hover:underline transition-colors">
              <p className="text-xs font-medium text-slate-100 truncate" title={displayRiotId}>
                {gameName}
              </p>
            </Link>
            <p className="text-[10px] text-slate-300 truncate">{championDetails?.name || 'Champion'}</p>
          </div>

          {/* Rank Info Section (Fixed Height) */}
          <div className={`mt-1 ${rankSectionHeightClass} flex flex-col justify-center items-center`}>
            {rankedEntries === undefined && !soloDuoRank && (
                <div className="flex justify-center items-center h-full">
                    <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
                </div>
            )}

            {soloDuoRank && (
              <div className="flex flex-col items-center">
                {/* Conditional rendering for the emblem image or spacer */}
                {soloDuoRank.tier && soloDuoRank.tier.toLowerCase() !== 'unranked' && soloDuoRank.tier.toLowerCase() !== 'none' ? (
                  <Image
                    src={getRankedEmblemUrl(soloDuoRank.tier)}
                    alt={soloDuoRank.tier || "Rank Emblem"}
                    width={rankedEmblemSize}
                    height={rankedEmblemSize}
                    className="mb-0.5"
                    onError={(e) => { (e.target as HTMLImageElement).src = `https://placehold.co/${rankedEmblemSize}x${rankedEmblemSize}/1f2937/374151?text=E`; }}
                  />
                ) : (
                  // Spacer for "Unranked" tier or if tier is None/empty
                  <div style={{ width: rankedEmblemSize, height: rankedEmblemSize }} className="mb-0.5"></div>
                )}
                <p className="text-[10px] text-slate-100 font-semibold">
                  {soloDuoRank.tier && soloDuoRank.tier.toLowerCase() !== 'unranked' && soloDuoRank.tier.toLowerCase() !== 'none'
                    ? `${soloDuoRank.tier.charAt(0).toUpperCase()}${soloDuoRank.tier.slice(1).toLowerCase()} ${soloDuoRank.rank}`
                    : "Unranked"}
                </p>
                <p className="text-[9px] text-slate-300">
                  {`${soloDuoRank.leaguePoints} LP`}
                </p>
                {!isArenaMode && (
                  <p className="text-[9px] text-slate-400 mt-0.5">
                    {`${soloDuoRank.wins}W ${soloDuoRank.losses}L (${Math.round((soloDuoRank.wins / (soloDuoRank.wins + soloDuoRank.losses || 1)) * 100)}%)`}
                  </p>
                )}
              </div>
            )}

            {/* Handles cases where rankedEntries is loaded, but soloDuoRank object itself is missing */}
            {rankedEntries !== undefined && !soloDuoRank && (
              <div className="flex flex-col items-center justify-center h-full"> {/* pt-1 removed, justify-center handles it with fixed height parent */}
                <div style={{ width: rankedEmblemSize, height: rankedEmblemSize }} className="mb-0.5"></div>
                <p className="text-xs text-slate-400 italic">Unranked</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

interface RuneTooltipProps {
  runes: ResolvedParticipantRunes | null;
  visible: boolean;
  position: { top: number; left: number };
  perkIdsFromApi?: number[];
}
const RuneTooltipContent: React.FC<RuneTooltipProps> = ({ runes, visible, position, perkIdsFromApi }) => {
  if (!visible || !runes) return null;
  const renderRune = (rune: DDragonRune | undefined, defaultName: string, index: number, originalId?: number) => {
    const key = rune ? `${rune.id}-${index}` : `${defaultName}-${index}`;
    if (!rune) {
      const nameToShow = originalId ? `${defaultName} (ID: ${originalId} - Data Missing?)` : `${defaultName} (N/A - Data Missing?)`;
      return ( <div key={key} className="flex items-center gap-2 py-0.5"> <div className="w-[20px] h-[20px] bg-slate-700 rounded-sm animate-pulse"></div> <span className="text-xs text-slate-500 italic">{nameToShow}</span> </div> );
    }
    return ( <div key={key} className="flex items-center gap-2 py-0.5"> <Image src={getDDragonAssetUrl(rune.icon)} alt={rune.name} width={20} height={20} className="rounded-sm bg-black/40" onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/20x20/1f2937/374151?text=R"; }} /> <span className="text-xs text-slate-200">{rune.name}</span> </div> );
  };
  return ( <div className="absolute z-50 p-3 bg-slate-900/95 border border-slate-700 rounded-lg shadow-xl w-72 text-sm backdrop-blur-sm" style={{ top: position.top, left: position.left, transform: 'translateY(-100%) translateX(-50%)' }} > {runes.keystone && ( <div className="mb-2 pb-1.5 border-b border-slate-700"> <p className="text-xs font-semibold text-purple-400 mb-1">{runes.primaryTreeName || 'Keystone'}</p> {renderRune(runes.keystone, "Keystone", 0, perkIdsFromApi?.[0])} </div> )} <div className="mb-2 pb-1.5 border-b border-slate-700"> <p className="text-xs font-semibold text-sky-400 mb-1">Primary Path</p> {runes.primaryRunes.map((rune, index) => renderRune(rune, `Primary ${index + 1}`, index, perkIdsFromApi?.[index + 1]))} </div> <div className="pb-1.5">  <p className="text-xs font-semibold text-emerald-400 mb-1">{runes.secondaryTreeName || 'Secondary Path'}</p> {runes.secondaryRunes.map((rune, index) => renderRune(rune, `Secondary ${index + 1}`, index, perkIdsFromApi?.[index + 4]))} </div> </div> );
};

interface LiveArenaTeam {
  subteamId: number; // Can be explicit from API or synthetic
  members: SpectatorParticipant[];
}

export function LiveGameCard({
  liveGameData,
  isLoading: initialDataLoading,
  error: initialDataError,
  searchedPlayerPuuid,
  currentPatchVersion,
  ddragonData
}: LiveGameCardProps) {

  const trpcClient = useTRPC();

  const [currentGameTime, setCurrentGameTime] = useState<number | null>(null);
  const [tooltipData, setTooltipData] = useState<ResolvedParticipantRunes | null>(null);
  const [tooltipPerkIds, setTooltipPerkIds] = useState<number[] | undefined>(undefined);
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [team1PlayerOrder, setTeam1PlayerOrder] = useState<SpectatorParticipant[]>([]);
  const [team2PlayerOrder, setTeam2PlayerOrder] = useState<SpectatorParticipant[]>([]);
  const [summonerInputsForRankedQuery, setSummonerInputsForRankedQuery] = useState<Array<{summonerId: string; platformId: string}>>([]);

  const isArenaMode = useMemo(() => {
    const arena = liveGameData?.gameQueueConfigId === 1700 || liveGameData?.gameMode?.toUpperCase() === 'CHERRY';
    // console.debug(`[${COMPONENT_NAME}] isArenaMode evaluated to: ${arena}`, { gameQueueConfigId: liveGameData?.gameQueueConfigId, gameMode: liveGameData?.gameMode });
    return arena;
  }, [liveGameData]);

  const arenaTeamsArray: LiveArenaTeam[] = useMemo(() => {
    const participants = liveGameData?.participants;
    if (!isArenaMode || !participants || participants.length === 0) {
        // console.debug(`[${COMPONENT_NAME}.arenaTeamsArray] Not Arena mode or no participants. Returning empty array.`);
        return [];
    }

    // console.debug(`[${COMPONENT_NAME}.arenaTeamsArray] Processing Arena participants. Count: ${participants.length}`);
    const groupedByExplicitSubteamId: Record<number, SpectatorParticipant[]> = {};
    let hasAnyExplicitSubteamId = false;

    participants.forEach(p => {
        // Ensure playerSubteamId is a number and not null/undefined before using it
        if (typeof p.playerSubteamId === 'number') {
            hasAnyExplicitSubteamId = true;
            if (!groupedByExplicitSubteamId[p.playerSubteamId]) {
                groupedByExplicitSubteamId[p.playerSubteamId] = [];
            }
            groupedByExplicitSubteamId[p.playerSubteamId].push(p);
        } else {
            // console.warn(`[${COMPONENT_NAME}.arenaTeamsArray] Arena participant ${p.summonerName || p.riotId} (PUUID: ${p.puuid}) missing or invalid playerSubteamId: ${p.playerSubteamId}.`);
        }
    });

    if (hasAnyExplicitSubteamId && Object.keys(groupedByExplicitSubteamId).length > 0) {
        const teamsFromExplicitIds = Object.entries(groupedByExplicitSubteamId)
            .map(([subteamId, members]) => ({
                subteamId: parseInt(subteamId),
                members: members.sort((a, b) => (a.summonerName || a.riotId || '').localeCompare(b.summonerName || b.riotId || '')),
            }))
            .sort((a, b) => a.subteamId - b.subteamId);
        
        // console.debug(`[${COMPONENT_NAME}.arenaTeamsArray] Processed Arena teams by EXPLICIT playerSubteamId:`, teamsFromExplicitIds);
        return teamsFromExplicitIds;
    }

    // Fallback: If NO participants have a valid playerSubteamId, try to infer teams by pairs.
    // This assumes participants are ordered [Team1P1, Team1P2, Team2P1, Team2P2, ...] by the API.
    // Arena typically has 2 players per team.
    // console.warn(`[${COMPONENT_NAME}.arenaTeamsArray] No valid explicit playerSubteamIds found. Attempting to infer teams by pairs assuming API order.`);
    const inferredTeams: LiveArenaTeam[] = [];
    const PLAYERS_PER_ARENA_TEAM = 2;

    if (participants.length > 0 && participants.length % PLAYERS_PER_ARENA_TEAM === 0) {
        for (let i = 0; i < participants.length; i += PLAYERS_PER_ARENA_TEAM) {
            const teamMembers: SpectatorParticipant[] = [];
            for (let j = 0; j < PLAYERS_PER_ARENA_TEAM; j++) {
                // This check is slightly redundant due to the outer loop structure but good for safety
                if (participants[i + j]) {
                    teamMembers.push(participants[i + j]);
                }
            }
            // Only form a team if we have the correct number of members for this slot
            if (teamMembers.length === PLAYERS_PER_ARENA_TEAM) {
                inferredTeams.push({
                    subteamId: (i / PLAYERS_PER_ARENA_TEAM) + 1, // Assign a synthetic, sequential ID (1-based)
                    members: teamMembers.sort((a, b) => (a.summonerName || a.riotId || '').localeCompare(b.summonerName || b.riotId || '')), // Sort members within the inferred team
                });
            } else {
                // This should ideally not be reached if participants.length % PLAYERS_PER_ARENA_TEAM === 0
                // console.warn(`[${COMPONENT_NAME}.arenaTeamsArray] Could not form a complete inferred team of ${PLAYERS_PER_ARENA_TEAM} starting at index ${i}. Found ${teamMembers.length} members.`);
            }
        }
    } else if (participants.length > 0) { // Only log warning if there were participants to begin with
        // console.warn(`[${COMPONENT_NAME}.arenaTeamsArray] Total participants (${participants.length}) is not a multiple of ${PLAYERS_PER_ARENA_TEAM}. Cannot reliably infer teams by pairs.`);
    }
    
    if (inferredTeams.length > 0) {
        // console.debug(`[${COMPONENT_NAME}.arenaTeamsArray] Processed Arena teams by INFERENCE (pairs from API order):`, inferredTeams);
        return inferredTeams;
    }

    // console.warn(`[${COMPONENT_NAME}.arenaTeamsArray] Could not group Arena participants by explicit ID or inference. Returning empty array.`);
    return [];

}, [isArenaMode, liveGameData?.participants]);


  type BulkRankedData = Record<string, LeagueEntryDTO[] | null>;

  const bulkRankedQueryDefinition = trpcClient.player.getBulkRankedEntries.queryOptions(
    { summonerInputs: summonerInputsForRankedQuery },
    {
      enabled: summonerInputsForRankedQuery.length > 0,
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000,   // 10 minutes
    }
  );

  const {
    data: bulkRankedData = {} as BulkRankedData,
    isLoading: isLoadingBulkRanked,
    isFetching: isFetchingBulkRanked,
  } = useQuery(bulkRankedQueryDefinition);

  useEffect(() => {
    if (liveGameData && liveGameData.participants) {
      if (!isArenaMode) {
        const newTeam1Participants = liveGameData.participants.filter(p => p.teamId === 100).slice(0,5);
        const newTeam2Participants = liveGameData.participants.filter(p => p.teamId === 200).slice(0,5);

        // Only update if participant list or count actually changes to avoid unnecessary re-renders
        setTeam1PlayerOrder(prevOrder => {
          const newPuids = newTeam1Participants.map(p => p.puuid).sort().join(',');
          const currentPuids = prevOrder.map(p => p.puuid).sort().join(',');
          if (prevOrder.length !== newTeam1Participants.length || newPuids !== currentPuids) {
            return newTeam1Participants;
          }
          return prevOrder;
        });

        setTeam2PlayerOrder(prevOrder => {
          const newPuids = newTeam2Participants.map(p => p.puuid).sort().join(',');
          const currentPuids = prevOrder.map(p => p.puuid).sort().join(',');
          if (prevOrder.length !== newTeam2Participants.length || newPuids !== currentPuids) {
            return newTeam2Participants;
          }
          return prevOrder;
        });
      }

      const newSummonerInputsForRanked = liveGameData.participants
        .filter(p => !p.bot && p.summonerId) // Ensure summonerId exists
        .map(p => ({
          summonerId: p.summonerId,
          platformId: liveGameData.platformId, // platformId from liveGameData
        }));

      setSummonerInputsForRankedQuery(prevInputs => {
        // Simple string comparison for change detection
        if (JSON.stringify(newSummonerInputsForRanked) !== JSON.stringify(prevInputs)) {
          return newSummonerInputsForRanked;
        }
        return prevInputs;
      });

    } else {
      // Clear lists if no live game data
      setTeam1PlayerOrder([]);
      setTeam2PlayerOrder([]);
      setSummonerInputsForRankedQuery([]);
    }
  }, [liveGameData, isArenaMode]); // Rerun when liveGameData or isArenaMode changes


  useEffect(() => {
    let timerId: NodeJS.Timeout | undefined;
    if (liveGameData && liveGameData.gameLength >= 0) {
      setCurrentGameTime(liveGameData.gameLength);
      timerId = setInterval(() => {
        setCurrentGameTime(prevTime => (prevTime !== null ? prevTime + 1 : 0));
      }, 1000);
    } else {
      setCurrentGameTime(null);
    }
    return () => {
      if (timerId) clearInterval(timerId);
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, [liveGameData]); // Rerun only when liveGameData changes

  const handleRuneHoverEnter = (event: React.MouseEvent<HTMLDivElement>, participantPerks: SpectatorPerks) => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    if (!participantPerks || !ddragonData.runeTreeData) return;
    setTooltipPerkIds(participantPerks.perkIds);
    const primaryTree = findRuneTreeById(ddragonData.runeTreeData, participantPerks.perkStyle);
    const secondaryTree = findRuneTreeById(ddragonData.runeTreeData, participantPerks.perkSubStyle);
    const resolvedRunes: ResolvedParticipantRunes = {
      keystone: undefined, primaryRunes: [undefined, undefined, undefined], secondaryRunes: [undefined, undefined],
      primaryTreeName: primaryTree?.name, secondaryTreeName: secondaryTree?.name,
    };
    if (participantPerks.perkIds && participantPerks.perkIds.length >= 6) { // Ensure enough perk IDs
      resolvedRunes.keystone = findRuneById(primaryTree, participantPerks.perkIds[0]);
      resolvedRunes.primaryRunes = [ findRuneById(primaryTree, participantPerks.perkIds[1]), findRuneById(primaryTree, participantPerks.perkIds[2]), findRuneById(primaryTree, participantPerks.perkIds[3]), ];
      resolvedRunes.secondaryRunes = [ findRuneById(secondaryTree, participantPerks.perkIds[4]), findRuneById(secondaryTree, participantPerks.perkIds[5]), ];
    }
    setTooltipData(resolvedRunes);
    const rect = event.currentTarget.getBoundingClientRect();
    setTooltipPosition({ top: rect.top + window.scrollY - 10, left: rect.left + window.scrollX + rect.width / 2 });
    setIsTooltipVisible(true);
  };
  const handleRuneHoverLeave = () => { hoverTimeoutRef.current = setTimeout(() => { setIsTooltipVisible(false); }, 200); };
  const handleTooltipMouseEnter = () => { if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current); };
  const handleTooltipMouseLeave = () => { setIsTooltipVisible(false); setTooltipData(null); setTooltipPerkIds(undefined); };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), // Allows small movements before drag starts
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates, })
  );

  function handleDragEnd(event: DragEndEvent) {
    const {active, over} = event;
    if (isArenaMode || !over || active.id === over.id) return; // Dragging disabled in Arena or if no move

    const activeId = String(active.id);
    const overId = String(over.id);

    // Determine which team's list to update
    const isTeam1Drag = team1PlayerOrder.some(p => p.puuid === activeId || p.puuid === overId);
    const isTeam2Drag = team2PlayerOrder.some(p => p.puuid === activeId || p.puuid === overId);

    if (isTeam1Drag) {
        setTeam1PlayerOrder((items) => {
            const oldIndex = items.findIndex(p => p.puuid === activeId);
            const newIndex = items.findIndex(p => p.puuid === overId);
            // Ensure both items are found in the current list before moving
            if (oldIndex !== -1 && newIndex !== -1) {
              return arrayMove(items, oldIndex, newIndex);
            }
            return items; // Return original items if indices are invalid
        });
    } else if (isTeam2Drag) {
        setTeam2PlayerOrder((items) => {
            const oldIndex = items.findIndex(p => p.puuid === activeId);
            const newIndex = items.findIndex(p => p.puuid === overId);
            if (oldIndex !== -1 && newIndex !== -1) {
              return arrayMove(items, oldIndex, newIndex);
            }
            return items;
        });
    }
  }


  if (initialDataLoading) return ( <div className="flex justify-center items-center h-64 w-full bg-slate-800/60 rounded-lg shadow-lg border border-slate-700/50"> <Loader2 className="h-12 w-12 animate-spin text-purple-400" /> <p className="ml-3 text-xl font-semibold text-purple-300">Loading Live Game...</p> </div> );
  if (initialDataError) return ( <div className="p-6 bg-red-900/30 border border-red-700/50 rounded-lg shadow-lg w-full text-center"> <AlertTriangle className="h-10 w-10 text-red-400 mx-auto mb-2" /> <p className="text-xl font-semibold text-red-300">Error Loading Live Game</p> <p className="text-red-400 mt-1">Could not fetch live game information.</p> {initialDataError.message && <p className="text-xs text-red-500 mt-2">Details: {initialDataError.message}</p>} </div> );
  if (!liveGameData) return ( <div className="p-6 bg-slate-800/60 border border-slate-700/50 rounded-lg shadow-lg w-full text-center"> <MonitorOff className="h-10 w-10 text-slate-400 mx-auto mb-2" /> <p className="text-xl font-semibold text-slate-300">Not In Game</p> <p className="text-slate-400 mt-1">This player is not currently in an active game.</p> </div> );

  const { gameMode, gameQueueConfigId, bannedChampions } = liveGameData;
  let gameModeDisplay = ddragonData.gameModeMap && gameQueueConfigId ? ddragonData.gameModeMap[gameQueueConfigId] : gameMode;
  if (!gameModeDisplay || (gameModeDisplay.toLowerCase() === 'classic' && gameMode.toLowerCase() !== 'classic')) {
    gameModeDisplay = gameMode; // Fallback to raw gameMode if map is insufficient
  }

  const team1Bans = bannedChampions.filter(b => b.teamId === 100);
  const team2Bans = bannedChampions.filter(b => b.teamId === 200);

  const renderTeamBans = (bans: SpectatorBannedChampion[], teamColorId: number) => (
    <div className={`flex flex-wrap justify-center items-center gap-2 mb-4 p-2 rounded-md shadow-md ${teamColorId === 100 ? 'bg-blue-900/40' : 'bg-red-900/40'}`}>
      <ShieldX size={20} className={`${teamColorId === 100 ? 'text-blue-400' : 'text-red-400'} mr-2 flex-shrink-0`} />
      {bans.length > 0 ? bans.map(ban => {
        const championDetails = ddragonData.championData ? Object.values(ddragonData.championData).find(c => c.key === String(ban.championId)) : undefined;
        if (ban.championId === -1) { // -1 indicates no ban for that slot
          return ( <div key={`no-ban-${ban.pickTurn}`} title="No Ban" className="flex items-center justify-center w-[28px] h-[28px] bg-slate-700/50 rounded-md border-2 border-slate-600"> <Ban size={16} className="text-slate-500" /> </div> );
        }
        return ( <div key={`ban-${ban.championId}-${ban.pickTurn}`} title={championDetails?.name || `ID: ${ban.championId}`}> <Image src={getChampionIconUrl(championDetails?.id, currentPatchVersion)} alt={championDetails?.name || 'Banned'} width={28} height={28} className="rounded-md opacity-75 border-2 border-slate-700" onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/28x28/4b5563/9ca3af?text=B"; }}/> </div> );
      }) : <p className="text-sm text-slate-500 italic">No bans</p>}
    </div>
  );

  const renderPlayerRowFor5v5 = (players: SpectatorParticipant[]) => (
    <SortableContext items={players.map(p => p.puuid)} strategy={rectSortingStrategy} disabled={false}>
      <div className="flex flex-wrap justify-center gap-3 md:gap-4">
        {players.map(p => {
          const championDetails = ddragonData.championData ? Object.values(ddragonData.championData).find(c => c.key === String(p.championId)) : undefined;
          const primaryRuneTree = p.perks ? findRuneTreeById(ddragonData.runeTreeData, p.perks.perkStyle) : undefined;
          const keystoneRune = p.perks && p.perks.perkIds && p.perks.perkIds.length > 0 ? findRuneById(primaryRuneTree, p.perks.perkIds[0]) : undefined;
          const secondaryRuneTree = p.perks ? findRuneTreeById(ddragonData.runeTreeData, p.perks.perkSubStyle) : undefined;
          const rankedDataForPlayer = bulkRankedData && p.summonerId ? bulkRankedData[p.summonerId] : undefined;

          return (
            <SortablePlayerCard
              key={p.puuid}
              id={p.puuid} // Required for SortableContext
              participant={p}
              championDetails={championDetails}
              keystoneRune={keystoneRune}
              secondaryTree={secondaryRuneTree}
              rankedEntries={rankedDataForPlayer}
              currentPatchVersion={currentPatchVersion}
              ddragonData={ddragonData}
              isSearchedPlayer={p.puuid === searchedPlayerPuuid}
              platformId={liveGameData.platformId}
              onRuneHoverEnter={handleRuneHoverEnter}
              onRuneHoverLeave={handleRuneHoverLeave}
              isArenaMode={false} // Explicitly false for 5v5
            />
          );
        })}
      </div>
    </SortableContext>
  );

  const renderArenaTeams = () => {
    // console.debug(`[${COMPONENT_NAME}] Rendering Arena teams. Count: ${arenaTeamsArray.length}`);
    if (arenaTeamsArray.length === 0 && liveGameData?.participants && liveGameData.participants.length > 0) {
        // console.warn(`[${COMPONENT_NAME}] No Arena teams formed, but participants exist. This might be due to missing playerSubteamId in data and inability to infer teams. Participants:`, liveGameData.participants);
        return <p className="text-center text-slate-400 italic">Could not group Arena players into teams. Data might be incomplete or in an unexpected format.</p>;
    }
    if (arenaTeamsArray.length === 0) {
        return <p className="text-center text-slate-400 italic">No players found or could be grouped for Arena mode display.</p>;
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
        {arenaTeamsArray.map((team) => (
            <div
            key={team.subteamId} // Use the subteamId (explicit or synthetic)
            className="bg-slate-800/40 p-2 sm:p-3 rounded-lg shadow-md border border-purple-600/50 flex flex-col items-center"
            >
            <h3 className="text-xs sm:text-sm font-semibold text-purple-300 mb-2 text-center flex items-center justify-center gap-1.5">
                <Users size={14} className="opacity-70"/> Team {team.subteamId}
            </h3>
            <div className="flex flex-row flex-wrap justify-center items-start gap-2 w-full">
                {team.members.map(p => {
                const championDetails = ddragonData.championData ? Object.values(ddragonData.championData).find(c => c.key === String(p.championId)) : undefined;
                const primaryRuneTree = p.perks ? findRuneTreeById(ddragonData.runeTreeData, p.perks.perkStyle) : undefined;
                const keystoneRune = p.perks && p.perks.perkIds && p.perks.perkIds.length > 0 ? findRuneById(primaryRuneTree, p.perks.perkIds[0]) : undefined;
                const secondaryRuneTree = p.perks ? findRuneTreeById(ddragonData.runeTreeData, p.perks.perkSubStyle) : undefined;
                const rankedDataForPlayer = bulkRankedData && p.summonerId ? bulkRankedData[p.summonerId] : undefined;
                return (
                    // Note: SortablePlayerCard is used here, but dragging is disabled via its props if isArenaMode is true
                    <PlayerCardDisplay // Directly use PlayerCardDisplay as sorting is not intended for arena teams display
                        key={p.puuid}
                        participant={p}
                        championDetails={championDetails}
                        keystoneRune={keystoneRune}
                        secondaryTree={secondaryRuneTree}
                        rankedEntries={rankedDataForPlayer}
                        currentPatchVersion={currentPatchVersion}
                        ddragonData={ddragonData}
                        isSearchedPlayer={p.puuid === searchedPlayerPuuid}
                        platformId={liveGameData.platformId}
                        onRuneHoverEnter={handleRuneHoverEnter}
                        onRuneHoverLeave={handleRuneHoverLeave}
                        isArenaMode={true} // Explicitly true for Arena
                    />
                );
                })}
            </div>
            </div>
        ))}
        </div>
    );
  };


  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} >
      <Card className="bg-slate-850 border border-slate-700 shadow-2xl w-full max-w-6xl mx-auto">
        <CardHeader className="pb-4 pt-5">
          <CardTitle className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-500 to-orange-400 flex items-center justify-center">
            <div className="w-3 h-3 bg-green-500 rounded-full mr-3 animate-pulse shadow-md"></div>
            Live Game Overview
            {(isLoadingBulkRanked || isFetchingBulkRanked) && <Loader2 className="h-5 w-5 animate-spin ml-2 text-slate-400" />}
          </CardTitle>
          <CardDescription className="text-slate-400 text-center text-sm md:text-base">
            {gameModeDisplay} - {currentGameTime !== null ? formatGameLength(currentGameTime) : 'Loading...'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 px-2 py-4 md:px-4">
          {isArenaMode ? (
            renderArenaTeams()
          ) : (
            <>
              <div>
                {renderTeamBans(team1Bans, 100)}
                {renderPlayerRowFor5v5(team1PlayerOrder)}
              </div>
              <hr className="border-slate-700/50 my-4" />
              <div>
                {renderTeamBans(team2Bans, 200)}
                {renderPlayerRowFor5v5(team2PlayerOrder)}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div onMouseEnter={handleTooltipMouseEnter} onMouseLeave={handleTooltipMouseLeave}>
        <RuneTooltipContent
            runes={tooltipData}
            visible={isTooltipVisible}
            position={tooltipPosition}
            perkIdsFromApi={tooltipPerkIds}
        />
      </div>
    </DndContext>
  );
}
