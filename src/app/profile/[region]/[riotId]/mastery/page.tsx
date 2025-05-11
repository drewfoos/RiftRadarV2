// app/profile/[region]/[riotId]/mastery/page.tsx
import { AllChampionMasteryPageClient } from './AllChampionMasteryPageClient';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react'; 
import { Loader2 } from 'lucide-react'; 

// Updated interface to expect params as a Promise
interface MasteryPageProps {
  params: Promise<{ // params is now a Promise
    region: string;
    riotId: string; 
  }>;
}

export async function generateMetadata({ params: paramsPromise }: MasteryPageProps): Promise<Metadata> {
  // Await the params Promise to resolve
  const { region, riotId } = await paramsPromise; 
  
  const [gameName = '', tagLine = ''] = riotId.includes('-') 
    ? riotId.split('-').map(decodeURIComponent) 
    : [decodeURIComponent(riotId), ''];

  const displayRiotId = tagLine ? `${gameName}#${tagLine}` : gameName;

  return {
    title: `${displayRiotId} - All Champion Mastery (${region.toUpperCase()}) - RiftRadar`,
    description: `View all champion mastery details for ${displayRiotId} on the ${region.toUpperCase()} server.`,
  };
}

export default async function MasteryPage({ params: paramsPromise }: MasteryPageProps) {
  // Await the params Promise to resolve
  const { region: encodedRegion, riotId: encodedRiotId } = await paramsPromise;

  let gameName: string;
  let tagLine: string;
  let region: string;

  // Basic validation for URL parameters before decoding
  if (!encodedRegion || !encodedRiotId) {
    console.error("MasteryPage: Region or RiotId parameter is missing from URL params.", { encodedRegion, encodedRiotId });
    notFound(); 
  }

  try {
    region = decodeURIComponent(encodedRegion);
    const decodedRiotId = decodeURIComponent(encodedRiotId);

    if (decodedRiotId.includes('-')) {
      const parts = decodedRiotId.split('-');
      gameName = parts[0]; // First part is gameName
      tagLine = parts.slice(1).join('-'); // The rest is tagLine
    } else {
      gameName = decodedRiotId;
      tagLine = ""; 
      console.warn(`MasteryPage: riotId param "${decodedRiotId}" did not contain a '-' separator. Assuming no tagline or an incomplete Riot ID.`);
    }
  } catch (error) {
    console.error("MasteryPage: Error decoding URL parameters.", error, { encodedRegion, encodedRiotId });
    notFound();
  }


  if (!gameName || !tagLine) {
    console.error(`MasteryPage: Invalid gameName or tagLine after parsing. GameName: "${gameName}", TagLine: "${tagLine}". Encoded RiotId: "${encodedRiotId}"`);
    notFound();
  }
  
  return (
    <main className="flex min-h-screen flex-col items-center bg-gray-900 dark:bg-slate-950 text-gray-900 dark:text-gray-100">
      <div className="w-full"> 
        <Suspense fallback={
            <div className="flex justify-center items-center min-h-[calc(100vh-150px)]">
              <Loader2 className="h-16 w-16 animate-spin text-purple-400" />
              <p className="ml-4 text-xl text-slate-300">Loading Mastery Page...</p>
            </div>
          }
        >
          <AllChampionMasteryPageClient
            region={region}
            gameName={gameName}
            tagLine={tagLine}
          />
        </Suspense>
      </div>
       <footer className="mt-16 text-center text-sm text-gray-500 dark:text-gray-400 pb-8">
         <p>&copy; {new Date().getFullYear()} RiftRadar. Not affiliated with Riot Games.</p>
       </footer>
    </main>
  );
}
