// app/page.tsx
import { getQueryClientCached, HydrateClient, rscTRPC } from '@/trpc/server';
import { Suspense } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
// Import the client component that handles search
// Ensure this path points to the correct component (likely PlayerProfileClient.tsx in the app directory)
import { PlayerProfileClient } from './PlayerProfileClient';

import type {
  DDragonArenaAugment,
  DDragonChampion,
  DDragonDataBundle,
  DDragonQueue,
  DDragonRuneTree,
  DDragonSummonerSpell
} from '@/types/ddragon'; // Adjust path if necessary

export const dynamic = 'force-dynamic';

// --- Data Dragon Fetching Logic ---
async function fetchDDragonJson(fileName: string, patchVersion: string, language: string = "en_US"): Promise<any> {
  const url = `https://ddragon.leagueoflegends.com/cdn/${patchVersion}/data/${language}/${fileName}.json`;
  console.log(`Fetching DDragon: ${url}`);
  try {
    const response = await fetch(url, { next: { revalidate: 60 * 60 * 24 } }); // Cache for 24 hours
    if (!response.ok) {
      console.error(`Failed to fetch ${fileName} from DDragon (patch: ${patchVersion}, lang: ${language}), status: ${response.status}, message: ${await response.text()}`);
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error(`Error fetching ${fileName} from DDragon:`, error);
    return null;
  }
}
async function fetchCommunityDragonArenaAugments(cdragonPatch: string = "latest"): Promise<Record<number, DDragonArenaAugment> | null> {
    const url = `https://raw.communitydragon.org/${cdragonPatch}/cdragon/arena/en_us.json`;
    console.log(`Fetching Arena Augments from Community Dragon: ${url}`);
    try {
      const response = await fetch(url, { next: { revalidate: 60 * 60 * 6 } }); // Cache for 6 hours
      if (!response.ok) {
        console.error(`Failed to fetch Arena Augments from Community Dragon (patch: ${cdragonPatch}), status: ${response.status}, message: ${await response.text()}`);
        // Try 'latest' as fallback if specific patch fails
        if (cdragonPatch !== 'latest') {
            console.log("Attempting fetch with 'latest' for Arena Augments...");
            return fetchCommunityDragonArenaAugments('latest');
        }
        return null;
      }
      const data = await response.json();
      if (data && typeof data === 'object' && data.augments && typeof data.augments === 'object') {
        const augmentsObject = data.augments as Record<string, DDragonArenaAugment>;
        const processedAugments: Record<number, DDragonArenaAugment> = {};
        for (const stringIdKey in augmentsObject) {
          const augment = augmentsObject[stringIdKey];
          if (augment && typeof augment.id === 'number') {
            processedAugments[augment.id] = augment;
          } else {
            console.warn(`Skipping malformed augment entry from Community Dragon with key ${stringIdKey}:`, augment);
          }
        }
        return processedAugments;
      }
      console.error("Arena Augments data from Community Dragon is not in the expected nested object format:", data);
      return null;
    } catch (error) {
      console.error("Error fetching or processing Arena Augments:", error);
      return null;
    }
  }
async function getAllDDragonData(): Promise<{ latestPatchVersion: string; ddragonData: DDragonDataBundle }> {
  let latestPatchVersion = "14.10.1"; // Fallback patch
  const ddragonData: DDragonDataBundle = { 
    summonerSpellData: null,
    runeTreeData: null,
    championData: null,
    gameModeMap: null,
    arenaAugmentData: null,
  };
  try {
    const versionsResponse = await fetch('https://ddragon.leagueoflegends.com/api/versions.json', { next: { revalidate: 60 * 30 } });
    if (versionsResponse.ok) {
      const versions: string[] = await versionsResponse.json();
      if (versions && versions.length > 0) {
        latestPatchVersion = versions[0];
      }
    } else {
      console.error("Failed to fetch Data Dragon versions, using fallback:", latestPatchVersion);
    }
  } catch (error) {
    console.error("Error fetching Data Dragon versions, using fallback:", latestPatchVersion, error);
  }
  console.log(`Using Data Dragon Patch Version for DDragon assets: ${latestPatchVersion}`);
  let cdragonPatchForArena = "latest";
  const patchParts = latestPatchVersion.split('.');
  if (patchParts.length >= 2) {
      cdragonPatchForArena = `${patchParts[0]}.${patchParts[1]}`;
  } else if (latestPatchVersion !== "latest") {
      console.warn(`DDragon patch format "${latestPatchVersion}" not ideal for CDragon, using "${cdragonPatchForArena}" for Arena Augments.`);
  }

  const [
    summonerJson,
    runesReforgedJson,
    championJson,
    queuesJson,
    processedArenaAugments
  ] = await Promise.all([
    fetchDDragonJson('summoner', latestPatchVersion),
    fetchDDragonJson('runesReforged', latestPatchVersion),
    fetchDDragonJson('champion', latestPatchVersion),
    fetch('https://static.developer.riotgames.com/docs/lol/queues.json', { next: { revalidate: 60 * 60 * 24 * 7 } })
      .then(res => res.ok ? res.json() : null)
      .catch(err => { console.error("Error fetching queues.json:", err); return null; }),
    fetchCommunityDragonArenaAugments(cdragonPatchForArena)
  ]);
  if (summonerJson?.data) { ddragonData.summonerSpellData = summonerJson.data as Record<string, DDragonSummonerSpell>; }
  if (runesReforgedJson && Array.isArray(runesReforgedJson)) { ddragonData.runeTreeData = runesReforgedJson as DDragonRuneTree[]; }
  if (championJson?.data) { ddragonData.championData = championJson.data as Record<string, DDragonChampion>; }
  if (queuesJson && Array.isArray(queuesJson)) {
    ddragonData.gameModeMap = queuesJson.reduce((acc: Record<number, string>, queue: DDragonQueue) => {
      if (queue.description) {
        acc[queue.queueId] = queue.description
          .replace(/ Games$/i, '').replace(/ 5v5$/i, '').replace(/ Summoner's Rift$/i, '')
          .replace(/ Twisted Treeline$/i, '').replace(/ Howling Abyss$/i, '');
      } else { acc[queue.queueId] = queue.map; }
      return acc;
    }, {});
  }
  ddragonData.arenaAugmentData = processedArenaAugments;
  if (ddragonData.arenaAugmentData) {
      console.log(`Loaded ${Object.keys(ddragonData.arenaAugmentData).length} Arena Augments.`);
  } else {
      console.warn("Arena Augment data was not loaded for Home page.");
  }
  return { latestPatchVersion, ddragonData };
}
// --- End Data Dragon Fetching Logic ---


export default async function Home() {
  const queryClient = getQueryClientCached();
  const { latestPatchVersion, ddragonData } = await getAllDDragonData();

  // Prefetching hello is optional
  await queryClient.prefetchQuery(
    rscTRPC.hello.queryOptions({ text: `RSC (DDragon Patch: ${latestPatchVersion})` })
  );

  console.log("Home Page: Rendering with enhanced light effects.");

  return (
    <HydrateClient>
      {/* Improved background with better dot pattern and animated light effects */}
      <main className="relative flex min-h-screen flex-col items-center justify-center p-4 overflow-hidden bg-dot-pattern text-gray-100">

        {/* Enhanced Background Light Effects */}
        <div aria-hidden="true" className="absolute inset-0 z-0 grid grid-cols-2 -space-x-52 opacity-50 dark:opacity-70 pointer-events-none">
            {/* Main purple/pink splash with animation */}
            <div className="radial-gradient-splash h-72 bg-gradient-to-br from-purple-600 to-pink-600 blur-[130px] dark:from-purple-700 dark:to-pink-700" 
                style={{ top: '5%', left: '10%' }}></div>
            
            {/* Secondary teal splash with different animation timing */}
            <div className="radial-gradient-splash h-56 bg-gradient-to-r from-emerald-500 to-teal-400 blur-[110px] dark:from-emerald-600 dark:to-teal-500" 
                style={{ bottom: '10%', right: '8%' }}></div>
            
            {/* Tertiary blue splash with different animation timing */}
            <div className="radial-gradient-splash h-60 bg-gradient-to-tl from-sky-500 to-blue-600 blur-[115px] dark:from-sky-600 dark:to-blue-700" 
                style={{ top: '35%', right: '40%' }}></div>
        </div>

        {/* Content Container with enhanced glass effect */}
        <div className="relative z-10 w-full max-w-xl backdrop-blur-md bg-gray-900/70 p-8 rounded-xl shadow-2xl border border-purple-500/30 card-dark">
          <header className="text-center mb-8">
            <h1 className="text-5xl sm:text-6xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">
              RiftRadar
            </h1>
            <p className="mt-3 text-lg text-purple-200/80">
              Search League of Legends Player Stats
            </p>
          </header>

          <ErrorBoundary
            fallback={
              <div className="p-4 my-4 text-red-100 bg-red-900/50 border border-red-700 rounded-md shadow-sm">
                <p className="font-semibold">An error occurred loading the search.</p>
              </div>
            }
          >
            <Suspense
              fallback={
                <div className="p-6 my-4 text-blue-300 bg-blue-900/50 border border-blue-700 rounded-md shadow-sm text-center">
                  <p className="text-xl">Loading Search...</p>
                </div>
              }
            >
              {/* Render the client component for search/navigation */}
              <PlayerProfileClient
                currentPatchVersion={latestPatchVersion}
                initialDDragonData={ddragonData}
              />
            </Suspense>
          </ErrorBoundary>
        </div>

        {/* Enhanced Footer with better contrast and spacing */}
        <footer className="relative z-10 mt-12 text-center text-xs text-purple-300/70 max-w-xl">
          <p className="font-medium">&copy; {new Date().getFullYear()} RiftRadar. Not affiliated with Riot Games.</p>
          <p className="mt-2 text-purple-300/60">
             RiftRadar is not endorsed by Riot Games and does not
             reflect the views or opinions of Riot Games or anyone officially
             involved in producing or managing Riot Games properties. Riot Games and
             all associated properties are trademarks or registered trademarks of
             Riot Games, Inc.
           </p>
        </footer>
      </main>
    </HydrateClient>
  );
}
