'use client';

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { AppRouter } from '@/trpc/routers/_app';
import type { TRPCClientErrorLike } from '@trpc/client';
import { LayoutDashboard, Loader2, Search, ShieldAlert, Users, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';

// Define the expected profile structure
interface ProfileHeaderData {
  name?: string;
  summonerLevel?: number; // Changed from 'level' to 'summonerLevel'
  profileIconId?: number;
}

interface ProfileHeaderProps {
  profile: ProfileHeaderData | null | undefined;
  gameName: string;
  tagLine: string;
  region: string;
  currentPatchVersion: string;
  profileError: TRPCClientErrorLike<AppRouter> | null;
}

// Helper to get profile icon URL
function getProfileIconUrl(iconId: number | undefined, patchVersion: string): string {
    if (!iconId || !patchVersion) return "https://placehold.co/96x96/1f2937/374151?text=P"; 
    return `https://ddragon.leagueoflegends.com/cdn/${patchVersion}/img/profileicon/${iconId}.png`;
}

// Define regions for search
const searchRegions = [
    { value: 'na1', label: 'NA' }, { value: 'euw1', label: 'EUW' }, { value: 'eun1', label: 'EUNE' },
    { value: 'kr', label: 'KR' }, { value: 'br1', label: 'BR' }, { value: 'jp1', label: 'JP' },
    { value: 'ru', label: 'RU' }, { value: 'oc1', label: 'OCE' }, { value: 'tr1', label: 'TR' },
    { value: 'la1', label: 'LAN' }, { value: 'la2', label: 'LAS' }, { value: 'ph2', label: 'PH' },
    { value: 'sg2', label: 'SG' }, { value: 'th2', label: 'TH' }, { value: 'tw2', label: 'TW' },
    { value: 'vn2', label: 'VN' },
];

// Custom Live Circle Icon component
const LiveCircleIcon = () => (
  <div className="w-2.5 h-2.5 bg-red-500 rounded-full mr-1.5 animate-pulse"></div>
);

// Tabs Data - All tabs are now links
const profileTabsDefinition = [
    { id: "overview", label: "Overview", icon: <LayoutDashboard className="h-4 w-4 mr-1.5" />, isLink: true, hrefSlug: "" }, 
    { id: "live", label: "Live", icon: <LiveCircleIcon />, isLink: true, hrefSlug: "live" },
    { id: "champions", label: "Champions", icon: <Users className="h-4 w-4 mr-1.5" />, isLink: true, hrefSlug: "champions" },
];


export function ProfileHeader({
  profile, gameName, tagLine, region, currentPatchVersion,
  profileError,
}: ProfileHeaderProps) {

  const [searchRiotIdInput, setSearchRiotIdInput] = useState("");
  const [searchSelectedRegion, setSearchSelectedRegion] = useState(region);
  const [isSearchNavigating, setIsSearchNavigating] = useState(false);
  const [searchFormError, setSearchFormError] = useState<string | null>(null);

  const router = useRouter();
  const pathname = usePathname(); 

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearchFormError(null);
    setIsSearchNavigating(true);

    const trimmedInput = searchRiotIdInput.trim();
    if (!trimmedInput) { setSearchFormError("Please enter a Riot ID."); setIsSearchNavigating(false); return; }
    if (!trimmedInput.includes('#')) { setSearchFormError("Include '#'. Ex: Name#TAG"); setIsSearchNavigating(false); return; }
    const parts = trimmedInput.split('#');
    if (parts.length !== 2 || !parts[0].trim() || !parts[1].trim()) { setSearchFormError("Invalid format. Ex: Name#TAG"); setIsSearchNavigating(false); return; }

    const searchGameName = parts[0].trim();
    const searchTagLine = parts[1].trim();

    if (searchGameName && searchTagLine && searchSelectedRegion) {
      const combinedRiotId = `${searchGameName}-${searchTagLine}`;
      const baseProfilePath = `/profile/${encodeURIComponent(searchSelectedRegion)}/${encodeURIComponent(combinedRiotId)}`;
      
      const currentlyOnSearchedProfileBaseOrSubpage = pathname.startsWith(baseProfilePath);

      if (searchGameName === gameName && searchTagLine === tagLine && searchSelectedRegion === region && currentlyOnSearchedProfileBaseOrSubpage) {
        setIsSearchNavigating(false);
        setSearchRiotIdInput(""); 
        return;
      }
      router.push(baseProfilePath); 
    } else {
      setSearchFormError("Invalid Riot ID or region.");
      setIsSearchNavigating(false);
    }
  };

  const displayName = profile?.name || gameName;
  const displayLevel = profile?.summonerLevel; // Changed to use summonerLevel
  const displayIconId = profile?.profileIconId;
  const encodedRiotIdForLink = encodeURIComponent(`${gameName}-${tagLine}`);
  const baseProfileUrl = `/profile/${region}/${encodedRiotIdForLink}`;

  return (
    <div className="w-full bg-gradient-to-b from-slate-900/95 to-slate-950/90 dark:from-slate-800/80 dark:to-slate-900/70 backdrop-blur-lg 
                  rounded-bl-3xl rounded-br-3xl
                  shadow-xl shadow-purple-600/15 mb-2">
      
      <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 py-1.5">
        <div className="flex items-center gap-x-4">
          <Link href="/" className="text-xl font-bold text-purple-300 hover:text-purple-200 transition-colors" title="Go to Home">
            LOGO {/* Replace with your actual logo component or image */}
          </Link>
        </div>

        <div className="flex-grow-0 min-w-[280px] sm:min-w-[300px] w-full sm:w-auto max-w-xs sm:max-w-sm">
          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <div className="relative flex-grow">
              <Input
                type="text"
                placeholder="Name#TAG"
                value={searchRiotIdInput}
                onChange={(e) => setSearchRiotIdInput(e.target.value)}
                className="h-9 text-sm bg-slate-800/70 border-purple-500/60 text-white placeholder-gray-400 focus:ring-1 focus:ring-purple-400 focus:border-purple-400 rounded-md pr-8"
                aria-label="Search Riot ID"
              />
              {searchRiotIdInput && (
                <Button type="button" variant="ghost" size="icon" className="absolute right-0.5 top-1/2 -translate-y-1/2 h-7 w-7 p-0 text-gray-400 hover:text-white" onClick={() => { setSearchRiotIdInput(''); setSearchFormError(null);}} aria-label="Clear search">
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            <Select value={searchSelectedRegion} onValueChange={setSearchSelectedRegion}>
              <SelectTrigger className="h-9 w-[75px] sm:w-[80px] shrink-0 text-xs bg-slate-800/70 border-purple-500/60 text-white focus:ring-1 focus:ring-purple-400 focus:border-purple-400 rounded-md">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-purple-600 text-white max-h-[180px] sm:max-h-[200px]">
                {searchRegions.map((r) => (
                  <SelectItem key={r.value} value={r.value} className="focus:bg-purple-600 focus:text-white cursor-pointer text-xs py-1.5">
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="submit" size="icon" className="h-9 w-9 shrink-0 bg-purple-600 hover:bg-purple-700 rounded-md text-white" disabled={isSearchNavigating}>
              {isSearchNavigating ? <Loader2 className="h-4 w-4 animate-spin"/> : <Search className="h-4 w-4" />}
            </Button>
          </form>
          {searchFormError && ( <p className="text-xs text-red-400 mt-1 pl-0.5">{searchFormError}</p> )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 md:pt-8 pb-0"> 
        
        <div className="flex flex-col items-start text-left md:flex-row md:items-center md:gap-x-6 mb-4 md:mb-6">
          <div className="relative mb-3 md:mb-0 shrink-0">
            <Avatar className="h-24 w-24 border-4 border-purple-400 rounded-lg shadow-md">
              <AvatarImage src={getProfileIconUrl(displayIconId, currentPatchVersion)} alt={`${displayName}'s Icon`} />
              <AvatarFallback className="text-2xl rounded-lg bg-slate-700 text-slate-300">{displayName?.[0]?.toUpperCase() ?? '?'}</AvatarFallback>
            </Avatar>
            {displayLevel !== undefined && (
              <Badge variant="secondary" className="absolute -bottom-1.5 -right-1.5 border-2 border-slate-900 bg-purple-500 text-white px-2 py-0.5 text-xs font-semibold shadow-sm">
                {displayLevel}
              </Badge>
            )}
          </div>
          <div className="flex-grow mt-1 md:mt-0">
            <h1 className="text-2xl font-bold text-white leading-tight" title={`${gameName}#${tagLine}`}>
              {gameName}
              <span className="text-slate-400 font-medium text-lg ml-1">#{tagLine}</span>
            </h1>
            <p className="text-base text-purple-300 font-medium mt-0.5">{region.toUpperCase()}</p>
          </div>
        </div>

        {profileError && (
          <div className="mb-3 md:mb-4">
            <Alert variant="destructive" className="text-xs p-2.5 rounded-md bg-red-900/40 border-red-700/60">
              <ShieldAlert className="h-4 w-4 text-red-300" />
              <AlertTitle className="text-xs font-semibold text-red-200">Profile Data Issue</AlertTitle>
              <AlertDescription className="text-red-300/90">{profileError.message}</AlertDescription>
            </Alert>
          </div>
        )}

        <div className="flex justify-center md:justify-start items-center"> 
            {profileTabsDefinition.map(tab => {
              const tabHref = tab.hrefSlug ? `${baseProfileUrl}/${tab.hrefSlug}` : baseProfileUrl;
              const isTabActive = pathname === tabHref;

              return (
                <Link
                  key={tab.id}
                  href={tabHref}
                  className={`relative flex items-center justify-center px-3 sm:px-4 pt-2 pb-3 text-sm font-medium transition-colors duration-150 ease-in-out focus:outline-none
                              ${isTabActive 
                                ? 'text-purple-300' 
                                : 'text-slate-400 hover:text-slate-200'
                              }`}
                  aria-current={isTabActive ? 'page' : undefined}
                >
                  {tab.icon}
                  {tab.label}
                  {isTabActive && (
                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-10 h-1 bg-purple-400 rounded-t-sm"></div>
                  )}
                </Link>
              );
            })}
        </div>
      </div>
    </div> 
  );
}
