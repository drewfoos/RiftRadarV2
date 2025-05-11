// app/profile/[region]/[riotId]/page.tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ErrorBoundary } from 'react-error-boundary';

// Import the client component for the ErrorBoundary fallback
import { ProfilePageErrorBoundaryFallback } from './ErrorBoundaryFallback';
// Import the main client component that displays the profile
import { UserProfilePageClient } from './UserProfilePageClient';

// Import shared types
import type {
  DDragonArenaAugment, DDragonDataBundle,
  DDragonQueue
} from '@/types/ddragon'; // Adjust path if needed
import { Loader2 } from 'lucide-react';

// Ensure the page is dynamically rendered
export const dynamic = 'force-dynamic';

// --- Data Dragon Fetching Logic ---
// Fetches individual JSON files from Data Dragon CDN
async function fetchDDragonJson(fileName: string, patchVersion: string, language: string = "en_US"): Promise<any> {
  const url = `https://ddragon.leagueoflegends.com/cdn/${patchVersion}/data/${language}/${fileName}.json`;
  try {
    // Fetch with revalidation strategy (cache for 24 hours)
    const response = await fetch(url, { next: { revalidate: 60 * 60 * 24 } });
    if (!response.ok) {
      console.error(`DDragon Fetch Error: ${fileName} (Patch: ${patchVersion}, Status: ${response.status})`);
      return null; // Return null on fetch error
    }
    return await response.json(); // Parse and return JSON data
  } catch (error) {
    console.error(`DDragon Network Error: ${fileName} (Patch: ${patchVersion})`, error);
    return null; // Return null on network or parsing error
  }
}

// Fetches Arena Augment data from Community Dragon (unofficial source)
async function fetchCommunityDragonArenaAugments(patchVersionForCDragon: string): Promise<Record<number, DDragonArenaAugment> | null> {
  const url = `https://raw.communitydragon.org/${patchVersionForCDragon}/cdragon/arena/en_us.json`;
  console.log(`Fetching Arena Augments from Community Dragon: ${url}`);
  try {
    const response = await fetch(url, { next: { revalidate: 60 * 60 * 6 } }); // Cache for 6 hours
    if (!response.ok) {
      console.error(`CDragon Augments Fetch Error (Patch: ${patchVersionForCDragon}, Status: ${response.status})`);
      // Fallback to 'latest' if specific patch fails
      if (patchVersionForCDragon !== "latest") {
        console.log("Attempting CDragon fetch with 'latest' patch for Arena Augments...");
        return fetchCommunityDragonArenaAugments("latest");
      }
      return null;
    }
    const data = await response.json();
    // Process the nested augment data into a Record keyed by numeric ID
    if (data?.augments && typeof data.augments === 'object') {
      const processed: Record<number, DDragonArenaAugment> = {};
      for (const key in data.augments) {
        const aug = data.augments[key];
        if (aug?.id && typeof aug.id === 'number') {
          processed[aug.id] = aug;
        }
      }
      return processed;
    }
    console.error("CDragon Augments data not in expected format:", data);
    return null;
  } catch (error) {
    console.error(`CDragon Augments Network Error (Patch: ${patchVersionForCDragon})`, error);
    return null;
  }
}

// Fetches all necessary static data (DDragon versions, spells, runes, champs, queues, augments)
async function getAllDDragonData(): Promise<{ latestPatchVersion: string; ddragonData: DDragonDataBundle }> {
  let latestPatchVersion = "14.10.1"; // Sensible fallback patch
  const ddragonData: DDragonDataBundle = { 
    summonerSpellData: null, 
    runeTreeData: null, 
    championData: null, 
    gameModeMap: null, 
    arenaAugmentData: null 
  };

  // Fetch latest patch version
  try {
    const versionsResponse = await fetch('https://ddragon.leagueoflegends.com/api/versions.json', { next: { revalidate: 60 * 30 } }); // Cache versions for 30 mins
    if (versionsResponse.ok) {
      const versions = await versionsResponse.json();
      if (versions?.[0]) { latestPatchVersion = versions[0]; }
    } else { console.warn(`Failed to fetch DDragon versions (Status: ${versionsResponse.status}), using fallback: ${latestPatchVersion}`); }
  } catch (e) { console.error("Error fetching DDragon versions, using fallback:", latestPatchVersion, e); }

  console.log(`ProfilePage Server: Using DDragon Patch for Riot Assets: ${latestPatchVersion}`);

  let cdragonPatchForArena = "latest";
  const patchParts = latestPatchVersion.split('.');
  if (patchParts.length >= 2) { cdragonPatchForArena = `${patchParts[0]}.${patchParts[1]}`; }
  else if (latestPatchVersion !== "latest") { console.warn(`DDragon patch format "${latestPatchVersion}" not ideal for CDragon, using "${cdragonPatchForArena}" for Arena Augments.`); }

  const [summonerJson, runesReforgedJson, championJson, queuesJson, processedArenaAugments] = await Promise.all([
    fetchDDragonJson('summoner', latestPatchVersion),
    fetchDDragonJson('runesReforged', latestPatchVersion),
    fetchDDragonJson('champion', latestPatchVersion),
    fetch('https://static.developer.riotgames.com/docs/lol/queues.json', { next: { revalidate: 60 * 60 * 24 * 7 } }).then(res => res.ok ? res.json() : null).catch(() => null),
    fetchCommunityDragonArenaAugments(cdragonPatchForArena)
  ]);

  if (summonerJson?.data) ddragonData.summonerSpellData = summonerJson.data;
  if (runesReforgedJson && Array.isArray(runesReforgedJson)) ddragonData.runeTreeData = runesReforgedJson;
  if (championJson?.data) ddragonData.championData = championJson.data;
  
  // --- Updated Game Mode Map Logic ---
  if (queuesJson && Array.isArray(queuesJson)) {
    const preferredGameModeNames: Record<number, string> = {
        400: "Draft", // Changed from "Normal Draft" to "Draft"
        420: "Solo", 
        430: "Blind",
        440: "Flex",
        450: "ARAM",
        700: "Clash",
        1700: "Arena",
        1900: "URF"
        // Add other specific overrides if needed
    };
    ddragonData.gameModeMap = queuesJson.reduce((acc: Record<number, string>, queue: DDragonQueue) => {
      if (preferredGameModeNames[queue.queueId]) {
        acc[queue.queueId] = preferredGameModeNames[queue.queueId];
      } else if (queue.description) {
        // Fallback: Clean up the description from queues.json
        acc[queue.queueId] = queue.description
          .replace(/ Games$/i, '')
          .replace(/ 5v5$/i, '')
          .replace(/ Summoner's Rift$/i, '')
          .replace(/ Twisted Treeline$/i, '')
          .replace(/ Howling Abyss$/i, '')
          .replace(/ Butcher's Bridge$/i, '') 
          .trim(); 
      } else {
        acc[queue.queueId] = queue.map; // Ultimate fallback to map name
      }
      return acc;
    }, {});
  }
  // --- End Updated Game Mode Map Logic ---

  ddragonData.arenaAugmentData = processedArenaAugments;
  if (ddragonData.arenaAugmentData) { console.log(`Loaded ${Object.keys(ddragonData.arenaAugmentData).length} Arena Augments.`); }
  else { console.warn("Arena Augment data was not loaded for ProfilePage."); }

  return { latestPatchVersion, ddragonData };
}

interface ProfilePageProps {
  params: Promise<{ 
    region: string; 
    riotId: string; 
  }>;
}

export async function generateMetadata({ params: paramsPromise }: ProfilePageProps): Promise<Metadata> {
  const { region, riotId } = await paramsPromise; 
  
  try {
    const decodedRiotId = decodeURIComponent(riotId ?? '');
    const decodedRegion = decodeURIComponent(region ?? '');
    const parts = decodedRiotId.split('-');
    const tagLine = parts.pop() || "TAG"; 
    const gameName = parts.join('-') || "Player"; 

    return {
      title: `Profile: ${gameName}#${tagLine} (${decodedRegion.toUpperCase()}) - RiftRadar`,
      description: `View League of Legends profile, stats, and match history for ${gameName}#${tagLine} on ${decodedRegion.toUpperCase()}.`
    };
  } catch (error) {
    console.error("Error generating metadata for profile page:", error, { region, riotId }); 
    return {
      title: "Player Profile - RiftRadar",
      description: "View League of Legends player profiles."
    };
  }
}

export default async function ProfilePage({ params: paramsPromise }: ProfilePageProps) {
  const { region: encodedRegion, riotId: encodedRiotId } = await paramsPromise;

  if (!encodedRegion || !encodedRiotId) {
    console.error("ProfilePage: Region or RiotId parameter is missing from URL params.", { encodedRegion, encodedRiotId });
    notFound(); 
  }

  let region: string;
  let riotId: string;

  try {
    region = decodeURIComponent(encodedRegion);
    riotId = decodeURIComponent(encodedRiotId);
  } catch (error) {
    console.error("ProfilePage: Error decoding URL parameters.", error, { encodedRegion, encodedRiotId });
    notFound();
  }

  const riotIdParts = riotId.split('-');
  if (riotIdParts.length < 2 && !(riotIdParts.length === 1 && riotId.length > 0) ) { 
    console.error(`ProfilePage: Invalid riotId format. Expected "gameName-tagLine" or just "gameName", got: "${riotId}"`);
    notFound();
  }
  const gameName = riotIdParts.slice(0, -1).join('-') || riotIdParts[0]; 
  const tagLine = riotIdParts.length > 1 ? riotIdParts[riotIdParts.length - 1] : ""; 

  if (!gameName ) { 
      console.error(`ProfilePage: Could not parse gameName from riotId: "${riotId}"`);
      notFound();
  }

  console.log(`ProfilePage Server Render: Region=${region}, GameName=${gameName}, TagLine=${tagLine}`);

  const { latestPatchVersion, ddragonData } = await getAllDDragonData();

  return (
    <main className="flex min-h-screen flex-col items-center bg-gray-900 dark:bg-slate-950 text-gray-900 dark:text-gray-100">
        <div className="w-full">
            <ErrorBoundary FallbackComponent={ProfilePageErrorBoundaryFallback}>
              <Suspense
                fallback={
                    <div className="flex justify-center items-center min-h-[60vh]">
                      <Loader2 className="h-12 w-12 animate-spin text-blue-400" />
                    </div>
                }
              >
                <UserProfilePageClient
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
