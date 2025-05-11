// app/profile/[region]/[riotId]/mastery/page.tsx
import { AllChampionMasteryPageClient } from './AllChampionMasteryPageClient';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react'; // Added Suspense
import { Loader2 } from 'lucide-react'; // For Suspense fallback

interface MasteryPageProps {
  params: {
    region: string;
    riotId: string; // Combined gameName-tagLine, e.g., "PlayerName-TAG"
  };
}

export async function generateMetadata({ params }: MasteryPageProps): Promise<Metadata> {
  const { region, riotId } = params;
  const [gameName = '', tagLine = ''] = riotId.includes('-') 
    ? riotId.split('-').map(decodeURIComponent) 
    : [decodeURIComponent(riotId), ''];

  const displayRiotId = tagLine ? `${gameName}#${tagLine}` : gameName;

  return {
    title: `${displayRiotId} - All Champion Mastery (${region.toUpperCase()}) - RiftRadar`,
    description: `View all champion mastery details for ${displayRiotId} on the ${region.toUpperCase()} server.`,
  };
}

export default async function MasteryPage({ params }: MasteryPageProps) {
  const { region, riotId } = params;

  let gameName: string;
  let tagLine: string;

  if (riotId.includes('-')) {
    const parts = riotId.split('-');
    gameName = decodeURIComponent(parts[0]);
    tagLine = decodeURIComponent(parts.slice(1).join('-'));
  } else {
    gameName = decodeURIComponent(riotId);
    tagLine = ""; 
    console.warn(`MasteryPage: riotId param "${riotId}" did not contain a '-' separator. Assuming no tagline or an incomplete Riot ID.`);
  }

  if (!gameName || !tagLine) {
    console.error(`MasteryPage: Invalid gameName or tagLine after parsing riotId "${riotId}". GameName: "${gameName}", TagLine: "${tagLine}". Redirecting to notFound.`);
    notFound();
  }
  
  return (
    // Added <main> tag with background and text color classes for consistency
    <main className="flex min-h-screen flex-col items-center bg-gray-900 dark:bg-slate-950 text-gray-900 dark:text-gray-100">
      <div className="w-full"> 
        {/* Suspense can be useful if AllChampionMasteryPageClient has its own loading states 
            or if you want a page-level fallback during initial client rendering.
            The client component itself handles its internal loading states for data fetching.
        */}
        <Suspense fallback={
            <div className="flex justify-center items-center min-h-[calc(100vh-150px)]"> {/* Adjusted height for page fallback */}
              <Loader2 className="h-16 w-16 animate-spin text-purple-400" />
              <p className="ml-4 text-xl text-slate-300">Loading Mastery Page...</p>
            </div>
          }
        >
          <AllChampionMasteryPageClient
            region={region}
            gameName={gameName}
            tagLine={tagLine}
            // currentPatchVersion and initialDDragonData props are removed
            // as the client component fetches this data using the tRPC procedure.
          />
        </Suspense>
      </div>
       {/* Footer outside the main content width constraint, consistent with ProfilePage */}
       <footer className="mt-16 text-center text-sm text-gray-500 dark:text-gray-400 pb-8">
         <p>&copy; {new Date().getFullYear()} RiftRadar. Not affiliated with Riot Games.</p>
       </footer>
    </main>
  );
}
