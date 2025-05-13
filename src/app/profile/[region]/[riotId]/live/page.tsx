// app/profile/[region]/[riotId]/live/page.tsx

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ErrorBoundary } from 'react-error-boundary';

import { ProfilePageErrorBoundaryFallback } from '../ErrorBoundaryFallback';
import { LiveGamePageClient } from './LiveGamePageClient'; 

import type {
  DDragonArenaAugment,
  DDragonDataBundle,
  DDragonQueue
} from '@/types/ddragon';
import { Loader2 } from 'lucide-react';

export const dynamic = 'force-dynamic'; 

async function fetchDDragonJson(fileName: string, patchVersion: string, language: string = "en_US"): Promise<any> {
  const url = `https://ddragon.leagueoflegends.com/cdn/${patchVersion}/data/${language}/${fileName}.json`;
  try {
    const response = await fetch(url, { next: { revalidate: 60 * 60 * 24 } }); 
    if (!response.ok) {
      console.error(`DDragon Fetch Error: ${fileName} (Patch: ${patchVersion}, Status: ${response.status})`);
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error(`DDragon Network Error: ${fileName} (Patch: ${patchVersion})`, error);
    return null;
  }
}

async function fetchCommunityDragonArenaAugments(patchVersionForCDragon: string): Promise<Record<number, DDragonArenaAugment> | null> {
  let attemptUrl = `https://raw.communitydragon.org/${patchVersionForCDragon}/cdragon/arena/en_us.json`;
  console.log(`[CDragon Augments] Attempting to fetch from: ${attemptUrl}`);
  try {
    let response = await fetch(attemptUrl, { next: { revalidate: 60 * 60 * 6 } }); 
    
    if (!response.ok) {
      console.warn(`[CDragon Augments] Fetch Error for patch "${patchVersionForCDragon}" (Status: ${response.status}). Trying "latest"...`);
      // Fallback to 'latest' if specific patch fails
      attemptUrl = `https://raw.communitydragon.org/latest/cdragon/arena/en_us.json`;
      console.log(`[CDragon Augments] Attempting to fetch from: ${attemptUrl}`);
      response = await fetch(attemptUrl, { next: { revalidate: 60 * 60 * 6 } });
      if (!response.ok) {
        console.error(`[CDragon Augments] Fetch Error for "latest" patch as well (Status: ${response.status}). No augment data loaded.`);
        return null;
      }
    }

    const data = await response.json();
    if (data?.augments && typeof data.augments === 'object') {
      const processed: Record<number, DDragonArenaAugment> = {};
      for (const key in data.augments) {
        const aug = data.augments[key];
        if (aug?.id && typeof aug.id === 'number') {
          processed[aug.id] = aug;
        }
      }
      console.log(`[CDragon Augments] Loaded ${Object.keys(processed).length} Arena Augments using patch segment from URL: ${attemptUrl.split('/')[3]}.`);
      return processed;
    }
    console.error("[CDragon Augments] Data not in expected format:", data);
    return null;
  } catch (error) {
    console.error(`[CDragon Augments] Network Error while fetching from ${attemptUrl}`, error);
    return null;
  }
}

async function getAllDDragonData(): Promise<{ latestPatchVersion: string; ddragonData: DDragonDataBundle }> {
  let latestPatchVersion = "14.10.1"; // Sensible fallback patch
  const ddragonData: DDragonDataBundle = { 
    summonerSpellData: null, 
    runeTreeData: null, 
    championData: null, 
    gameModeMap: null, 
    arenaAugmentData: null 
  };

  try {
    const versionsResponse = await fetch('https://ddragon.leagueoflegends.com/api/versions.json', { next: { revalidate: 60 * 30 } });
    if (versionsResponse.ok) {
      const versions = await versionsResponse.json();
      if (versions?.[0]) { latestPatchVersion = versions[0]; }
    } else { console.warn(`Failed to fetch DDragon versions (Status: ${versionsResponse.status}), using fallback: ${latestPatchVersion}`); }
  } catch (e) { console.error("Error fetching DDragon versions, using fallback:", latestPatchVersion, e); }

  console.log(`LiveGamePage Server: Using DDragon Patch for Riot Assets: ${latestPatchVersion}`);

  // For Community Dragon, try 'latest' first, or major.minor.
  // It's often more reliable to just use 'latest' for community dragon if specific patch mapping is problematic.
  const cdragonPatchForArena = "latest"; 
  // const patchParts = latestPatchVersion.split('.');
  // if (patchParts.length >= 2) { cdragonPatchForArena = `${patchParts[0]}.${patchParts[1]}`; }
  // else if (latestPatchVersion !== "latest") { console.warn(`DDragon patch format "${latestPatchVersion}" not ideal for CDragon, using "${cdragonPatchForArena}" for Arena Augments.`); }


  const [summonerJson, runesReforgedJson, championJson, queuesJson, processedArenaAugments] = await Promise.all([
    fetchDDragonJson('summoner', latestPatchVersion),
    fetchDDragonJson('runesReforged', latestPatchVersion),
    fetchDDragonJson('champion', latestPatchVersion),
    fetch('https://static.developer.riotgames.com/docs/lol/queues.json', { next: { revalidate: 60 * 60 * 24 * 7 } }).then(res => res.ok ? res.json() : null).catch(() => null),
    fetchCommunityDragonArenaAugments(cdragonPatchForArena) // Pass the determined cdragon patch
  ]);

  if (summonerJson?.data) ddragonData.summonerSpellData = summonerJson.data;
  if (runesReforgedJson && Array.isArray(runesReforgedJson)) ddragonData.runeTreeData = runesReforgedJson;
  if (championJson?.data) ddragonData.championData = championJson.data;
  if (queuesJson && Array.isArray(queuesJson)) {
    const preferredGameModeNames: Record<number, string> = {
        400: "Draft",
        420: "Ranked Solo", 
        430: "Normal Blind",
        440: "Ranked Flex",
        450: "ARAM",
        700: "Clash",
        1700: "Arena",
        1900: "URF"
    };
    ddragonData.gameModeMap = queuesJson.reduce((acc: Record<number, string>, queue: DDragonQueue) => {
      if (preferredGameModeNames[queue.queueId]) {
        acc[queue.queueId] = preferredGameModeNames[queue.queueId];
      } else if (queue.description) {
        acc[queue.queueId] = queue.description
          .replace(/ Games$/i, '')
          .replace(/ 5v5$/i, '')
          .replace(/ Summoner's Rift$/i, '')
          .replace(/ Twisted Treeline$/i, '')
          .replace(/ Howling Abyss$/i, '')
          .replace(/ Butcher's Bridge$/i, '') 
          .trim(); 
      } else {
        acc[queue.queueId] = queue.map; 
      }
      return acc;
    }, {});
  }
  ddragonData.arenaAugmentData = processedArenaAugments;
  // Removed the console log for arena augments here, fetchCommunityDragonArenaAugments logs it.

  return { latestPatchVersion, ddragonData };
}

interface LiveProfilePageProps {
  params: Promise<{ 
    region: string;
    riotId: string; 
  }>;
}

export async function generateMetadata({ params: paramsPromise }: LiveProfilePageProps): Promise<Metadata> {
  const params = await paramsPromise; 
  const { region: encodedRegion, riotId: encodedRiotId } = params;
  
  try {
    const decodedRiotId = decodeURIComponent(encodedRiotId ?? '');
    const decodedRegion = decodeURIComponent(encodedRegion ?? '');
    const parts = decodedRiotId.split('-');
    const tagLine = parts.pop() || "TAG";
    const gameName = parts.join('-') || "Player";

    return {
      title: `Live Game: ${gameName}#${tagLine} (${decodedRegion.toUpperCase()}) - RiftRadar`,
      description: `View live game details for League of Legends player ${gameName}#${tagLine} on ${decodedRegion.toUpperCase()}.`
    };
  } catch (error) {
    console.error("Error generating metadata for live game page:", error, params); 
    return {
      title: "Live Game - RiftRadar",
      description: "View live League of Legends game details."
    };
  }
}

export default async function LiveGamePage({ params: paramsPromise }: LiveProfilePageProps) {
  const params = await paramsPromise;
  const { region: encodedRegion, riotId: encodedRiotId } = params;

  if (!encodedRegion || !encodedRiotId) {
    console.error("LiveGamePage: Region or RiotId parameter is missing from URL params.");
    notFound(); 
  }

  let region: string;
  let riotId: string;

  try {
    region = decodeURIComponent(encodedRegion);
    riotId = decodeURIComponent(encodedRiotId);
  } catch (error) {
    console.error("LiveGamePage: Error decoding URL parameters.", error, params); 
    notFound();
  }

  const riotIdParts = riotId.split('-');
  // Allow just gameName if no tagline is provided in URL, but tagLine will be empty string
  const gameName = riotIdParts.length > 1 ? riotIdParts.slice(0, -1).join('-') : riotIdParts[0];
  const tagLine = riotIdParts.length > 1 ? riotIdParts[riotIdParts.length - 1] : "";

  if (!gameName ) { // TagLine can be empty, but gameName must exist
      console.error(`LiveGamePage: Could not parse gameName from riotId: "${riotId}"`);
      notFound();
  }

  console.log(`LiveGamePage Server Render: Region=${region}, GameName=${gameName}, TagLine=${tagLine}`);
  const { latestPatchVersion, ddragonData } = await getAllDDragonData();

  return (
    <main className="flex min-h-screen flex-col items-center bg-gray-900 dark:bg-slate-950 text-gray-900 dark:text-gray-100">
      <div className="w-full">
        <ErrorBoundary FallbackComponent={ProfilePageErrorBoundaryFallback}>
          <Suspense
            fallback={
              <div className="flex flex-col justify-center items-center min-h-[calc(100vh-200px)]">
                <Loader2 className="h-12 w-12 animate-spin text-purple-400" />
                <p className="mt-4 text-lg text-slate-300">Loading Live Game Page...</p>
              </div>
            }
          >
            <LiveGamePageClient
              region={region}
              gameName={gameName}
              tagLine={tagLine}
              currentPatchVersion={latestPatchVersion}
              initialDDragonData={ddragonData}
            />
          </Suspense>
        </ErrorBoundary>
      </div>
      <footer className="mt-16 text-center text-sm text-gray-500 dark:text-gray-400 pb-8">
        <p>&copy; {new Date().getFullYear()} RiftRadar. Not affiliated with Riot Games.</p>
      </footer>
    </main>
  );
}
