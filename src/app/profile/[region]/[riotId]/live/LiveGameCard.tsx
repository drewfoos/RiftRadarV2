'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTRPC } from '@/trpc/client';
import type { AppRouter } from '@/trpc/routers/_app';
import type { DDragonChampion, DDragonDataBundle, DDragonRune, DDragonRuneTree, LeagueEntryDTO } from '@/types/ddragon';
import type { CurrentGameInfo, BannedChampion as SpectatorBannedChampion, Perks as SpectatorPerks } from '@/types/spectatorV5';
import { useQuery } from '@tanstack/react-query';
import type { TRPCClientErrorLike } from '@trpc/client';
import { AlertTriangle, Ban, GripVertical, Loader2, MonitorOff, ShieldX } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

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
    if (!path) return "https://placehold.co/24x24/1f2937/374151?text=A"; 
    return `https://ddragon.leagueoflegends.com/cdn/img/${path}`;
}

function getChampionIconUrl(championNameId: string | undefined, patchVersion: string): string {
    if (!championNameId) return "https://placehold.co/72x72/1f2937/374151?text=C";
    return `https://ddragon.leagueoflegends.com/cdn/${patchVersion}/img/champion/${championNameId}.png`;
}

function getSummonerSpellIconUrl(spellId: number, spellData: DDragonDataBundle['summonerSpellData'], patchVersion: string): string {
    if (!spellData) return "https://placehold.co/28x28/1f2937/374151?text=S";
    const spell = Object.values(spellData).find(s => s.key === String(spellId));
    if (!spell) return "https://placehold.co/28x28/1f2937/374151?text=S";
    return `https://ddragon.leagueoflegends.com/cdn/${patchVersion}/img/spell/${spell.id}.png`;
}

function getRankedEmblemUrl(tier?: string): string {
  const defaultUnrankedPath = "/images/ranked-emblems/Rank=Unranked.png"; 
  if (!tier || tier.toLowerCase() === 'unranked' || tier.toLowerCase() === 'none') {
    return defaultUnrankedPath;
  }
  const formattedTier = tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase();
  const knownTiers = ["Iron", "Bronze", "Silver", "Gold", "Platinum", "Emerald", "Diamond", "Master", "Grandmaster", "Challenger"];
  if (knownTiers.includes(formattedTier)) {
    return `/images/ranked-emblems/Rank=${formattedTier}.png`;
  }
  return defaultUnrankedPath; 
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

// --- Player Card Display Component (Modified for Drag & Drop) ---
interface PlayerCardDisplayProps {
  participant: CurrentGameInfo['participants'][0]; 
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
}

const SortablePlayerCard: React.FC<PlayerCardDisplayProps & { id: string }> = (props) => {
  const {
    attributes,
    listeners, 
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({id: props.id});

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.8 : 1, 
    zIndex: isDragging ? 100 : undefined, 
    touchAction: 'none', 
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
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
}) => {
  const fullRiotId = participant.riotId && participant.riotId.trim() !== '' ? participant.riotId : participant.summonerName || 'Player';
  const gameName = fullRiotId.includes('#') ? fullRiotId.split('#')[0] : fullRiotId;
  const tagLine = fullRiotId.includes('#') ? fullRiotId.split('#')[1] : '';

  const teamColorClass = participant.teamId === 100 ? 'border-blue-500' : 'border-red-500';
  const searchedPlayerHighlight = isSearchedPlayer ? 'ring-2 ring-purple-500 shadow-purple-500/50' : 'hover:ring-1 hover:ring-slate-500';
  const runeIconStyle = "rounded-full bg-black/50 p-0.5 border border-slate-600 shadow-md";

  const soloDuoRank = rankedEntries?.find(entry => entry.queueType === "RANKED_SOLO_5x5");
  const profileLink = `/profile/${platformId}/${gameName}-${tagLine}`;

  return (
    <div 
      className={`player-card bg-slate-800/70 rounded-lg shadow-lg w-[180px] md:w-[200px] transition-all duration-200 ease-in-out ${searchedPlayerHighlight} flex flex-col cursor-grab active:cursor-grabbing`}
    >
      <div 
        className={`h-16 rounded-t-lg ${participant.teamId === 100 ? 'bg-blue-600/30' : 'bg-red-600/30'} flex items-center justify-center`}
      >
        <GripVertical size={20} className="text-slate-400/30" /> 
      </div>
      <div className="relative px-2 pb-3 -mt-12 flex flex-col items-center flex-grow"> 
        <div className="flex justify-around items-end w-full mb-2">
          {!participant.bot && (
            <div className="flex flex-col gap-1 self-center">
              <Image 
                src={getSummonerSpellIconUrl(participant.spell1Id, ddragonData.summonerSpellData, currentPatchVersion)} 
                alt="Spell 1" width={28} height={28} className="rounded border-2 border-slate-900 shadow-md" 
                onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/28x28/1f2937/374151?text=S1"; }}/>
              <Image 
                src={getSummonerSpellIconUrl(participant.spell2Id, ddragonData.summonerSpellData, currentPatchVersion)} 
                alt="Spell 2" width={28} height={28} className="rounded border-2 border-slate-900 shadow-md"
                onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/28x28/1f2937/374151?text=S2"; }}/>
            </div>
          )}
          {participant.bot && <div className="w-[30px]"></div>} 
          <div className="relative">
            <Image
              src={getChampionIconUrl(championDetails?.id, currentPatchVersion)}
              alt={championDetails?.name || 'Champion'}
              width={72} 
              height={72}
              className={`rounded-full border-4 ${teamColorClass} shadow-xl bg-slate-900`} 
              onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/72x72/1f2937/374151?text=C"; }}
            />
          </div>
          {!participant.bot && participant.perks && (
            <div 
              className="flex flex-col items-center gap-1 self-center cursor-default" 
              onMouseEnter={(e) => participant.perks && onRuneHoverEnter(e, participant.perks)}
              onMouseLeave={onRuneHoverLeave}
            >
              {keystoneRune && ( <Image src={getDDragonAssetUrl(keystoneRune.icon)} alt={keystoneRune.name} width={28} height={28} className={runeIconStyle} title={keystoneRune.name} onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/28x28/1f2937/374151?text=K"; }} /> )}
              {secondaryTree && ( <Image src={getDDragonAssetUrl(secondaryTree.icon)} alt={secondaryTree.name} width={28} height={28} className={runeIconStyle} title={secondaryTree.name} onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/28x28/1f2937/374151?text=S"; }} /> )}
            </div>
          )}
           {participant.bot && <div className="w-[32px]"></div>}
        </div>
        <div className="text-center w-full space-y-1 mt-1 flex-grow flex flex-col justify-between"> 
          <div> 
            <Link href={profileLink} className="hover:text-purple-400 hover:underline transition-colors">
              <p className="text-sm font-semibold text-slate-100 truncate" title={fullRiotId}>
                {gameName}
              </p>
            </Link>
            <p className="text-xs text-slate-300">{championDetails?.name || 'Champion'}</p>
          </div>
          
          <div className="mt-2 min-h-[70px] flex flex-col justify-center items-center"> 
            {rankedEntries === undefined && !soloDuoRank && ( 
                <div className="flex justify-center items-center h-full">
                    <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                </div>
            )}
            {soloDuoRank && (
              <div className="flex flex-col items-center">
                <Image 
                  src={getRankedEmblemUrl(soloDuoRank.tier)} 
                  alt={soloDuoRank.tier || "Rank Emblem"} 
                  width={56} 
                  height={56}
                  className="mb-1" 
                  onError={(e) => { (e.target as HTMLImageElement).src = getRankedEmblemUrl("Unranked"); }} 
                />
                <p className="text-sm text-slate-100 font-semibold"> 
                  {`${soloDuoRank.tier.charAt(0)}${soloDuoRank.tier.slice(1).toLowerCase()} ${soloDuoRank.rank}`}
                </p>
                <p className="text-xs text-slate-300"> 
                  {`${soloDuoRank.leaguePoints} LP`}
                </p>
                <p className="text-xs text-slate-400 mt-0.5"> 
                  {`${soloDuoRank.wins}W ${soloDuoRank.losses}L (${Math.round((soloDuoRank.wins / (soloDuoRank.wins + soloDuoRank.losses || 1)) * 100)}%)`}
                </p>
              </div>
            )}
            {rankedEntries !== undefined && !soloDuoRank && ( 
              <div className="flex flex-col items-center justify-center h-full pt-1">
                <p className="text-sm text-slate-400 italic">Unranked</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Tooltip Component ---
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

  const [team1PlayerOrder, setTeam1PlayerOrder] = useState<CurrentGameInfo['participants'][0][]>([]);
  const [team2PlayerOrder, setTeam2PlayerOrder] = useState<CurrentGameInfo['participants'][0][]>([]);

  const [summonerInputsForRankedQuery, setSummonerInputsForRankedQuery] = useState<Array<{summonerId: string; platformId: string}>>([]);

  type BulkRankedData = Record<string, LeagueEntryDTO[] | null>;

  const bulkRankedQueryDefinition = trpcClient.player.getBulkRankedEntries.queryOptions(
    { summonerInputs: summonerInputsForRankedQuery },
    {
      enabled: summonerInputsForRankedQuery.length > 0,
      staleTime: 5 * 60 * 1000, 
      gcTime: 10 * 60 * 1000,  
    }
  );

  const { 
    data: bulkRankedData = {} as BulkRankedData, 
    isLoading: isLoadingBulkRanked,
    isFetching: isFetchingBulkRanked,
  } = useQuery(bulkRankedQueryDefinition); 

  useEffect(() => {
    if (liveGameData && liveGameData.participants) {
      const newTeam1Participants = liveGameData.participants.filter(p => p.teamId === 100).slice(0,5);
      const newTeam2Participants = liveGameData.participants.filter(p => p.teamId === 200).slice(0,5);

      // Only update order if the actual set of participants for a team changes.
      // This helps preserve user's dragged order if liveGameData updates but participants are the same.
      const newTeam1Puids = newTeam1Participants.map(p => p.puuid).sort().join(',');
      const currentTeam1Puids = team1PlayerOrder.map(p => p.puuid).sort().join(',');
      
      if (team1PlayerOrder.length !== newTeam1Participants.length || newTeam1Puids !== currentTeam1Puids) {
        setTeam1PlayerOrder(newTeam1Participants);
      }

      const newTeam2Puids = newTeam2Participants.map(p => p.puuid).sort().join(',');
      const currentTeam2Puids = team2PlayerOrder.map(p => p.puuid).sort().join(',');

      if (team2PlayerOrder.length !== newTeam2Participants.length || newTeam2Puids !== currentTeam2Puids) {
        setTeam2PlayerOrder(newTeam2Participants);
      }
      
      const newSummonerInputsForRanked = liveGameData.participants
        .filter(p => !p.bot && p.summonerId) 
        .map(p => ({
          summonerId: p.summonerId,
          platformId: liveGameData.platformId, 
        }));
      
      // Only update if the inputs actually change to avoid unnecessary query re-evaluations
      if (JSON.stringify(newSummonerInputsForRanked) !== JSON.stringify(summonerInputsForRankedQuery)) {
        setSummonerInputsForRankedQuery(newSummonerInputsForRanked);
      }

    } else {
      setTeam1PlayerOrder([]);
      setTeam2PlayerOrder([]);
      setSummonerInputsForRankedQuery([]); 
    }
  // Only depend on liveGameData for this effect.
  // The internal logic handles whether to update the order states.
  }, [liveGameData]); 


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
  }, [liveGameData]);

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
    if (participantPerks.perkIds && participantPerks.perkIds.length >= 6) { 
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
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), 
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates, })
  );

  function handleDragEnd(event: DragEndEvent) {
    const {active, over} = event;
    if (!over || active.id === over.id) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    const isTeam1Drag = team1PlayerOrder.some(p => p.puuid === activeId || p.puuid === overId);
    const isTeam2Drag = team2PlayerOrder.some(p => p.puuid === activeId || p.puuid === overId);

    if (isTeam1Drag) {
        setTeam1PlayerOrder((items) => {
            const oldIndex = items.findIndex(p => p.puuid === activeId);
            const newIndex = items.findIndex(p => p.puuid === overId);
            // Ensure both items are actually in this list before moving
            if (items.some(p=>p.puuid === activeId) && items.some(p=>p.puuid === overId) && oldIndex !== -1 && newIndex !== -1) {
              return arrayMove(items, oldIndex, newIndex);
            }
            return items; 
        });
    } else if (isTeam2Drag) {
        setTeam2PlayerOrder((items) => {
            const oldIndex = items.findIndex(p => p.puuid === activeId);
            const newIndex = items.findIndex(p => p.puuid === overId);
             if (items.some(p=>p.puuid === activeId) && items.some(p=>p.puuid === overId) && oldIndex !== -1 && newIndex !== -1) {
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
    gameModeDisplay = gameMode;
  }
  
  const team1Bans = bannedChampions.filter(b => b.teamId === 100);
  const team2Bans = bannedChampions.filter(b => b.teamId === 200);

  const renderTeamBans = (bans: SpectatorBannedChampion[], teamId: number) => (
    <div className={`flex flex-wrap justify-center items-center gap-2 mb-4 p-2 rounded-md shadow-md ${teamId === 100 ? 'bg-blue-900/40' : 'bg-red-900/40'}`}>
      <ShieldX size={20} className={`${teamId === 100 ? 'text-blue-400' : 'text-red-400'} mr-2 flex-shrink-0`} />
      {bans.length > 0 ? bans.map(ban => {
        const championDetails = ddragonData.championData ? Object.values(ddragonData.championData).find(c => c.key === String(ban.championId)) : undefined;
        if (ban.championId === -1) {
          return ( <div key={`no-ban-${ban.pickTurn}`} title="No Ban" className="flex items-center justify-center w-[28px] h-[28px] bg-slate-700/50 rounded-md border-2 border-slate-600"> <Ban size={16} className="text-slate-500" /> </div> );
        }
        return ( <div key={`ban-${ban.championId}-${ban.pickTurn}`} title={championDetails?.name || `ID: ${ban.championId}`}> <Image src={getChampionIconUrl(championDetails?.id, currentPatchVersion)} alt={championDetails?.name || 'Banned'} width={28} height={28} className="rounded-md opacity-75 border-2 border-slate-700" onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/28x28/4b5563/9ca3af?text=B"; }}/> </div> );
      }) : <p className="text-sm text-slate-500 italic">No bans</p>}
    </div>
  );
  
  const renderPlayerRow = (teamPlayerOrder: CurrentGameInfo['participants'][0][], teamId: number) => (
    <SortableContext items={teamPlayerOrder.map(p => p.puuid)} strategy={rectSortingStrategy}>
      <div className="flex flex-wrap justify-center gap-3 md:gap-4">
        {teamPlayerOrder.map(p => {
          const championDetails = ddragonData.championData ? Object.values(ddragonData.championData).find(c => c.key === String(p.championId)) : undefined;
          const primaryRuneTree = p.perks ? findRuneTreeById(ddragonData.runeTreeData, p.perks.perkStyle) : undefined;
          const keystoneRune = p.perks && p.perks.perkIds && p.perks.perkIds.length > 0 ? findRuneById(primaryRuneTree, p.perks.perkIds[0]) : undefined;
          const secondaryRuneTree = p.perks ? findRuneTreeById(ddragonData.runeTreeData, p.perks.perkSubStyle) : undefined; 
          const rankedDataForPlayer = bulkRankedData ? bulkRankedData[p.summonerId] : undefined;

          return (
            <SortablePlayerCard
              key={p.puuid}
              id={p.puuid} 
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
            />
          );
        })}
      </div>
    </SortableContext>
  );

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
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
          <div>
            {renderTeamBans(team1Bans, 100)}
            {renderPlayerRow(team1PlayerOrder, 100)} 
          </div>
          <hr className="border-slate-700/50 my-4" />
          <div>
            {renderTeamBans(team2Bans, 200)}
            {renderPlayerRow(team2PlayerOrder, 200)} 
          </div>
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
