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
  const ddragonData: DDragonDataBundle = { summonerSpellData: null, runeTreeData: null, championData: null, gameModeMap: null, arenaAugmentData: null };

  // Fetch latest patch version
  try {
    const versionsResponse = await fetch('https://ddragon.leagueoflegends.com/api/versions.json', { next: { revalidate: 60 * 30 } }); // Cache versions for 30 mins
    if (versionsResponse.ok) {
      const versions = await versionsResponse.json();
      if (versions?.[0]) { latestPatchVersion = versions[0]; }
    } else { console.warn(`Failed to fetch DDragon versions (Status: ${versionsResponse.status}), using fallback: ${latestPatchVersion}`); }
  } catch (e) { console.error("Error fetching DDragon versions, using fallback:", latestPatchVersion, e); }

  console.log(`ProfilePage Server: Using DDragon Patch for Riot Assets: ${latestPatchVersion}`);

  // Determine Community Dragon patch version (usually major.minor or 'latest')
  let cdragonPatchForArena = "latest";
  const patchParts = latestPatchVersion.split('.');
  if (patchParts.length >= 2) { cdragonPatchForArena = `${patchParts[0]}.${patchParts[1]}`; }
  else if (latestPatchVersion !== "latest") { console.warn(`DDragon patch format "${latestPatchVersion}" not ideal for CDragon, using "${cdragonPatchForArena}" for Arena Augments.`); }

  // Fetch all static data in parallel
  const [summonerJson, runesReforgedJson, championJson, queuesJson, processedArenaAugments] = await Promise.all([
    fetchDDragonJson('summoner', latestPatchVersion),
    fetchDDragonJson('runesReforged', latestPatchVersion),
    fetchDDragonJson('champion', latestPatchVersion),
    fetch('https://static.developer.riotgames.com/docs/lol/queues.json', { next: { revalidate: 60 * 60 * 24 * 7 } }).then(res => res.ok ? res.json() : null).catch(() => null), // Cache queues for 7 days
    fetchCommunityDragonArenaAugments(cdragonPatchForArena)
  ]);

  // Populate the ddragonData bundle
  if (summonerJson?.data) ddragonData.summonerSpellData = summonerJson.data;
  if (runesReforgedJson && Array.isArray(runesReforgedJson)) ddragonData.runeTreeData = runesReforgedJson;
  if (championJson?.data) ddragonData.championData = championJson.data;
  if (queuesJson && Array.isArray(queuesJson)) {
    // Process queue data into a map of queueId to cleaned description/map name
    ddragonData.gameModeMap = queuesJson.reduce((acc: Record<number, string>, queue: DDragonQueue) => {
      acc[queue.queueId] = queue.description?.replace(/ Games$| 5v5$| Summoner's Rift$| Twisted Treeline$| Howling Abyss$/i, '') || queue.map;
      return acc;
    }, {});
  }
  ddragonData.arenaAugmentData = processedArenaAugments; // Assign potentially null augment data
  if (ddragonData.arenaAugmentData) { console.log(`Loaded ${Object.keys(ddragonData.arenaAugmentData).length} Arena Augments.`); }
  else { console.warn("Arena Augment data was not loaded for ProfilePage."); }

  return { latestPatchVersion, ddragonData };
}
// --- End Data Dragon Fetching Logic ---

// Interface defining the expected URL parameters for this dynamic route
interface ProfilePageProps {
  params: Promise<{
    region: string; // e.g., "na1"
    riotId: string; // Combined "gameName-tagLine"
  }>;
}

// Function to generate dynamic metadata (title, description) for the page head
export async function generateMetadata({ params }: ProfilePageProps): Promise<Metadata> {
  // Need to await params since they're wrapped in a Promise in Next.js 15
  const { region, riotId } = await params;
  
  try {
    // Decode parameters safely
    const decodedRiotId = decodeURIComponent(riotId ?? '');
    const decodedRegion = decodeURIComponent(region ?? '');
    const parts = decodedRiotId.split('-');
    const tagLine = parts.pop() || "TAG"; // Provide default if split fails
    const gameName = parts.join('-') || "Player"; // Provide default

    return {
      title: `Profile: ${gameName}#${tagLine} (${decodedRegion.toUpperCase()}) - RiftRadar`,
      description: `View League of Legends profile, stats, and match history for ${gameName}#${tagLine} on ${decodedRegion.toUpperCase()}.`
    };
  } catch (error) {
    // Fallback metadata in case of errors during generation
    console.error("Error generating metadata for profile page:", error, params);
    return {
      title: "Player Profile - RiftRadar",
      description: "View League of Legends player profiles."
    };
  }
}

// The main Server Component for the profile page route
export default async function ProfilePage({ params }: ProfilePageProps) {
  // In Next.js 15, params is now a Promise that needs to be awaited
  const { region: encodedRegion, riotId: encodedRiotId } = await params;

  // Basic validation for URL parameters
  if (!encodedRegion || !encodedRiotId) {
    console.error("ProfilePage: Region or RiotId parameter is missing from URL params.", params);
    notFound(); // Trigger Next.js 404 page
  }

  let region: string;
  let riotId: string;

  // Decode parameters, handle potential errors
  try {
    region = decodeURIComponent(encodedRegion);
    riotId = decodeURIComponent(encodedRiotId);
  } catch (error) {
    console.error("ProfilePage: Error decoding URL parameters.", error, params);
    notFound();
  }

  // Parse gameName and tagLine from the combined riotId parameter
  const riotIdParts = riotId.split('-');
  if (riotIdParts.length < 2) {
    console.error(`ProfilePage: Invalid riotId format. Expected "gameName-tagLine", got: "${riotId}"`);
    notFound();
  }
  const gameName = riotIdParts.slice(0, -1).join('-');
  const tagLine = riotIdParts[riotIdParts.length - 1];
  if (!gameName || !tagLine) {
      console.error(`ProfilePage: Could not parse gameName or tagLine from riotId: "${riotId}"`);
      notFound();
  }

  console.log(`ProfilePage Server Render: Region=${region}, GameName=${gameName}, TagLine=${tagLine}`);

  // Fetch static Data Dragon assets required by the client component
  const { latestPatchVersion, ddragonData } = await getAllDDragonData();

  return (
    // Main container with dark background
    <main className="flex min-h-screen flex-col items-center bg-gray-900 dark:bg-slate-950 text-gray-900 dark:text-gray-100">
        {/* Full-width container for the client component */}
        <div className="w-full">
            {/* Error boundary to catch client-side errors */}
            <ErrorBoundary FallbackComponent={ProfilePageErrorBoundaryFallback}>
              {/* Suspense for loading state while client component hydrates/fetches */}
              <Suspense
                fallback={
                  // Simple loading indicator shown during initial client component load
                  <div className="flex justify-center items-center min-h-[60vh]">
                    <Loader2 className="h-12 w-12 animate-spin text-blue-400" />
                  </div>
                }
              >
                {/* Render the main client component, passing necessary data */}
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
      {/* Footer outside the main content width constraint */}
      <footer className="mt-16 text-center text-sm text-gray-500 dark:text-gray-400 pb-8">
        <p>&copy; {new Date().getFullYear()} RiftRadar. Not affiliated with Riot Games.</p>
      </footer>
    </main>
  );
}