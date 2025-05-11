// app/profile/[region]/[riotId]/utils.tsx
'use client'; // Keep 'use client' if any helpers might eventually use client-side hooks, otherwise remove if purely server/shared logic.

import { Badge } from '@/components/ui/badge';
import type {
  DDragonArenaAugment,
  DDragonChampion,
  DDragonRuneTree,
  DDragonSummonerSpell
} from '@/types/ddragon'; // Import necessary types
import { Trophy } from 'lucide-react';
import { JSX } from 'react'; // Import JSX type for return annotation

// --- Constants ---
const DDRAGON_BASE_URL = "https://ddragon.leagueoflegends.com/cdn";
const COMMUNITY_DRAGON_THEMED_ASSET_BASE = "https://raw.communitydragon.org/t/";

// --- Image URL Helpers ---

/**
 * Returns the URL for a summoner profile icon.
 * Uses a placeholder if data is missing.
 * @param iconId - The profile icon ID.
 * @param patchVersion - The current Data Dragon patch version.
 * @returns The image URL string.
 */
export function getProfileIconUrl(iconId: number | undefined, patchVersion: string): string {
    if (!iconId || !patchVersion) return "https://placehold.co/80x80/1f2937/374151?text=P";
    return `${DDRAGON_BASE_URL}/${patchVersion}/img/profileicon/${iconId}.png`;
}

/**
 * Returns the local path for a ranked emblem image.
 * Assumes images are stored in public/images/ranked-emblems/Rank=TIER.png format.
 * @param tier - The ranked tier (e.g., "GOLD", "PLATINUM").
 * @returns The image path string.
 */
export function getRankIconUrl(tier?: string): string {
    const basePath = '/images/ranked-emblems/'; // Ensure these images exist in public/images/ranked-emblems/
    if (!tier || tier.toLowerCase() === 'unranked') { return `${basePath}Rank=Unranked.png`; }
    const tierName = tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase();
    // Verify these filenames match your downloaded assets
    const filename = `Rank=${tierName}.png`;
    return `${basePath}${filename}`;
}

/**
 * Returns the URL for a champion square icon (typically used for mastery display).
 * @param championNameId - The DDragon champion ID (e.g., "MissFortune").
 * @param patchVersion - The current Data Dragon patch version.
 * @returns The image URL string.
 */
export function getChampionIconUrl(championNameId: string | undefined, patchVersion: string): string {
    if (!championNameId || !patchVersion) return "https://placehold.co/40x40/1f2937/374151?text=C";
    return `${DDRAGON_BASE_URL}/${patchVersion}/img/champion/${championNameId}.png`;
}

/**
 * Returns the URL for a champion square icon, attempting to match API name to DDragon key.
 * Used for match history champion icons.
 * @param championApiName - Name from Riot API (e.g., "Miss Fortune").
 * @param patchVersion - The current Data Dragon patch version.
 * @param champData - Optional Data Dragon champion data map.
 * @returns The image URL string.
 */
export function getChampionSquareAssetUrl(
    championApiName: string | undefined,
    patchVersion: string,
    champData?: Record<string, DDragonChampion> | null
): string {
    if (!championApiName) return "https://placehold.co/40x40/1f2937/374151?text=C"; // Placeholder if name is missing
    let keyToUse = championApiName.replace(/[^a-zA-Z0-9]/g, ''); // Default key guess based on API name
    // If DDragon data is provided, try to find the exact DDragon ID (like "MissFortune")
    if (champData) {
        const foundChamp = Object.values(champData).find(c => c.name === championApiName || c.id === championApiName);
        if (foundChamp) keyToUse = foundChamp.id; // Use the correct DDragon ID if found
    }
    return `${DDRAGON_BASE_URL}/${patchVersion}/img/champion/${keyToUse}.png`;
}

/**
 * Returns the URL for an item icon.
 * @param itemId - The item ID.
 * @param patchVersion - The current Data Dragon patch version.
 * @returns The image URL string or a placeholder.
 */
export function getItemImageUrl(itemId: number | undefined, patchVersion: string): string {
    if (!itemId || itemId === 0) return "https://placehold.co/32x32/1f2937/374151?text=%20"; // Darker placeholder for empty slot
    return `${DDRAGON_BASE_URL}/${patchVersion}/img/item/${itemId}.png`;
}

/**
 * Returns the URL for a summoner spell icon.
 * @param spellApiId - The numeric spell ID from the Riot API.
 * @param patchVersion - The current Data Dragon patch version.
 * @param spellData - Optional Data Dragon summoner spell data map.
 * @returns The image URL string or a placeholder.
 */
export function getSummonerSpellImageUrl(
    spellApiId: number | undefined,
    patchVersion: string,
    spellData?: Record<string, DDragonSummonerSpell> | null
): string {
    if (!spellApiId || !spellData) return `https://placehold.co/24x24/1f2937/374151?text=S${spellApiId ?? ''}`;
    // Find spell by matching numeric key (stored as string in DDragon)
    const foundSpell = Object.values(spellData).find((s) => parseInt(s.key) === spellApiId);
    if (foundSpell) {
      return `${DDRAGON_BASE_URL}/${patchVersion}/img/spell/${foundSpell.image.full}`;
    }
    return `https://placehold.co/24x24/1f2937/374151?text=S?`; // Placeholder indicating lookup failure
}

/**
 * Returns the URL for a rune or rune tree icon.
 * @param id - The numeric ID of the rune or tree.
 * @param patchVersion - The current Data Dragon patch version.
 * @param runeTrees - Optional array of Data Dragon rune tree data.
 * @returns The image URL string or a placeholder.
 */
export function getRuneOrTreeIconUrl(
    id: number | undefined,
    patchVersion: string,
    runeTrees?: DDragonRuneTree[] | null
): string {
    const placeholder = `https://placehold.co/24x24/1f2937/374151?text=R`;
    if (!id || !runeTrees) return placeholder;
    try {
        // Check if it's a tree ID first
        const tree = runeTrees.find((t) => t.id === id);
        if (tree?.icon) return `${DDRAGON_BASE_URL}/img/${tree.icon}`;
        // If not a tree, search all runes within all trees/slots
        for (const t of runeTrees) {
            for (const slot of t.slots) {
                const foundRune = slot.runes.find((r) => r.id === id);
                if (foundRune?.icon) return `${DDRAGON_BASE_URL}/img/${foundRune.icon}`;
            }
        }
    } catch (error) { console.error("Error finding rune/tree icon:", error); }
    return placeholder; // Fallback if not found or error occurs
}

/**
 * Returns the URL for an Arena augment icon from Community Dragon.
 * @param augmentId - The numeric ID of the augment.
 * @param augmentData - Optional map of augment data keyed by ID.
 * @param ddragonFullPatchVersion - The full Data Dragon patch version (e.g., "14.10.1").
 * @returns The image URL string or a placeholder.
 */
export function getAugmentImageUrl(
    augmentId?: number,
    augmentData?: Record<number, DDragonArenaAugment> | null,
    ddragonFullPatchVersion?: string
): string {
    if (!augmentId || augmentId === 0) return "https://placehold.co/24x24/1F2937/4A5563?text=X";
    if (!augmentData) return `https://placehold.co/24x24/1F2937/4A5563?text=A${augmentId}`;
    const foundAugment = augmentData[augmentId];
    if (!foundAugment) return `https://placehold.co/24x24/1F2937/4A5563?text=A?${augmentId}`;

    const iconPathFromData = foundAugment.iconSmall || foundAugment.iconLarge || foundAugment.iconPath;
    if (iconPathFromData && typeof iconPathFromData === 'string') {
        // Clean up path and determine patch segment
        let relativePath = iconPathFromData.toLowerCase().replace(/\.dds$/, '.png');
        if (!relativePath.endsWith('.png')) relativePath += '.png';
        let cdragonPatchSegment = "latest";
        if (ddragonFullPatchVersion && ddragonFullPatchVersion !== "latest") {
            const parts = ddragonFullPatchVersion.split('.');
            cdragonPatchSegment = (parts.length >= 2) ? `${parts[0]}.${parts[1]}` : ddragonFullPatchVersion;
        }
        // Construct the full URL (adjust base path and prefix as needed based on actual JSON data)
        const urlPath = relativePath.startsWith('assets/') ? relativePath : `assets/ux/cherry/augments/icons/${relativePath}`;
        return `${COMMUNITY_DRAGON_THEMED_ASSET_BASE}${cdragonPatchSegment}/game/${urlPath}`;
    }
    return `https://placehold.co/24x24/38A169/FFFFFF?text=A${augmentId}&font=roboto`; // Fallback
}


// --- Formatting Helpers ---

/**
 * Formats large mastery points into k (thousands) or M (millions).
 * @param points - The number of mastery points.
 * @returns A formatted string.
 */
export function formatMasteryPoints(points: number): string {
    if (points >= 1_000_000) { return (points / 1_000_000).toFixed(1) + 'M'; }
    if (points >= 1_000) { return (points / 1_000).toFixed(1) + 'k'; }
    return points.toString();
}

/**
 * Calculates and formats KDA ratio. Handles division by zero for perfect KDA.
 * @param k - Kills.
 * @param d - Deaths.
 * @param a - Assists.
 * @returns A formatted KDA string (e.g., "4.50:1 KDA", "Perfect (15)").
 */
export function formatKDA(k: number, d: number, a: number): string {
    const kda = d === 0 ? (k + a).toFixed(1) : ((k + a) / d).toFixed(2);
    return d === 0 ? `Perfect (${k+a})` : `${kda}:1 KDA`;
}

/**
 * Calculates win rate percentage.
 * @param wins - Number of wins.
 * @param losses - Number of losses.
 * @returns The win rate percentage (0-100).
 */
export function calculateWinRate(wins: number, losses: number): number {
    const totalGames = wins + losses;
    return totalGames === 0 ? 0 : Math.round((wins / totalGames) * 100);
}

/**
 * Converts an epoch timestamp (in milliseconds) to a relative time string (e.g., "5m ago", "2d ago").
 * @param timestampMillis - The timestamp in milliseconds.
 * @returns A relative time string.
 */
export function timeAgo(timestampMillis: number): string {
    const now = Date.now(); const seconds = Math.round((now - timestampMillis) / 1000);
    if (seconds < 60) return `${seconds}s ago`; const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`; const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h ago`; const days = Math.round(hours / 24);
    if (days < 2) return `1d ago`; if (days < 7) return `${days}d ago`;
    const weeks = Math.round(days / 7);
    if (weeks <= 4) return `${weeks}w ago`;
    return new Date(timestampMillis).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Formats duration in seconds to MM:SS format.
 * @param durationInSeconds - The duration in seconds.
 * @returns A formatted time string (MM:SS).
 */
export function formatGameDuration(durationInSeconds: number): string {
    const minutes = Math.floor(durationInSeconds / 60); const seconds = durationInSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`; // Pad seconds with leading zero if needed
}

// --- Arena Specific Helpers ---

/**
 * Returns shorthand placement text (1st, 2nd, 3rd, 4th, Nth).
 * @param placement - The placement number.
 * @returns The formatted placement string.
 */
export const getPlacementTextShorthand = (placement?: number): string => {
    if (!placement) return "N/A";
    if (placement === 1) return "1st"; if (placement === 2) return "2nd";
    if (placement === 3) return "3rd"; if (placement === 4) return "4th";
    return `${placement}th`;
};

/**
 * Returns a styled Badge component for Arena placement.
 * @param placement - The placement number.
 * @returns A JSX element representing the badge.
 */
export const getPlacementBadge = (placement?: number): JSX.Element => {
    const baseClass = "text-xs px-1.5 py-0.5 font-semibold shadow";
    if (placement === 1) return <Badge className={`${baseClass} bg-yellow-500 text-yellow-950 border border-yellow-600`}><Trophy className="inline h-3 w-3 mr-1" />#1</Badge>;
    if (placement && placement <= 4) return <Badge className={`${baseClass} bg-blue-600 text-blue-100 border border-blue-700`}>Top {placement}</Badge>;
    if (placement) return <Badge variant="secondary" className={`${baseClass} bg-red-700 text-red-100 border border-red-800`}>#{placement}</Badge>;
    return <Badge variant="outline" className={`${baseClass} text-gray-400 border-gray-600`}>N/A</Badge>;
};

/**
 * Returns Tailwind border color class based on augment rarity.
 * @param rarity - The rarity number (0: Silver, 1: Gold, 2: Prismatic).
 * @returns Tailwind border color class string.
 */
export const getAugmentRarityBorder = (rarity?: number): string => {
    switch (rarity) {
      case 0: return "border-slate-400"; // Silver
      case 1: return "border-yellow-600"; // Gold
      case 2: return "border-purple-500"; // Prismatic
      default: return "border-slate-600"; // Default/Unknown
    }
};

/**
 * Returns Tailwind border color class based on placement for the left bar accent.
 * @param placement - The placement number.
 * @returns Tailwind border color class string.
 */
export const getPlacementColorClasses = (placement?: number): string => {
    if (placement === 1) return "border-yellow-500"; // Gold for 1st
    if (placement && placement <= 4) return "border-blue-500"; // Blue for Top 4 (Win)
    return "border-red-600"; // Red for Loss (5th-8th)
};
