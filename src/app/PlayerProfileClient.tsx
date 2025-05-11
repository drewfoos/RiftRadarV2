// app/PlayerProfileClient.tsx
'use client';

import { useTRPC } from '@/trpc/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useDebounce } from 'use-debounce';

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Search, ShieldAlert, X } from 'lucide-react';
import Image from 'next/image';

import type { DDragonDataBundle } from '@/types/ddragon';

interface RiotIdSuggestion {
    gameName: string;
    tagLine: string;
    puuid: string;
    profileIconId: number | null;
}

// Updated regions array based on your list, with corresponding platform IDs
const regions = [
  { value: 'br1',  label: 'BR' },    // Row 1
  { value: 'eun1', label: 'EUNE' },  // Row 1
  { value: 'euw1', label: 'EUW' },  // Row 1
  { value: 'jp1',  label: 'JP' },    // Row 1
  { value: 'kr',   label: 'KR' },    // Row 1
  { value: 'la1',  label: 'LAN' },   // Row 1
  { value: 'la2',  label: 'LAS' },   // Row 1
  { value: 'me1',  label: 'ME' },    // Row 1 (Note: ME1 is for Middle East, ensure this is the correct platform ID you intend)
  // Second row
  { value: 'na1',  label: 'NA' },    // Row 2
  { value: 'oc1',  label: 'OCE' },   // Row 2
  { value: 'ru',   label: 'RU' },    // Row 2
  { value: 'sg2',  label: 'SEA' },   // Row 2 (Using SG2 for SEA as a representative; other SEA platforms: ph2, th2, vn2, tw2)
  { value: 'tr1',  label: 'TR' },    // Row 2
  { value: 'tw2',  label: 'TW' },    // Row 2
  { value: 'vn2',  label: 'VN' },    // Row 2
];

interface PlayerProfileClientProps {
  currentPatchVersion: string;
  initialDDragonData: DDragonDataBundle; 
}

function getSuggestionProfileIconUrl(iconId: number | null, patchVersion: string): string {
    if (!iconId || !patchVersion) return "https://placehold.co/24x24/374151/9CA3AF?text=?";
    return `https://ddragon.leagueoflegends.com/cdn/${patchVersion}/img/profileicon/${iconId}.png`;
}


export function PlayerProfileClient({ currentPatchVersion }: PlayerProfileClientProps) {
  const [riotIdInput, setRiotIdInput] = useState("");
  const [selectedRegion, setSelectedRegion] = useState(regions[0].value); // Default to the first region in the new list (BR)
  const [isNavigating, setIsNavigating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  const [debouncedRiotIdInput] = useDebounce(riotIdInput, 300);

  const trpcClient = useTRPC();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLUListElement>(null);
  const queryClient = useQueryClient(); 

  const searchInputQuery = useMemo(() => debouncedRiotIdInput.split('#')[0].trim(), [debouncedRiotIdInput]);
  const isInputValidForSearch = useMemo(() => searchInputQuery.length >= 2 && !debouncedRiotIdInput.includes('#'), [searchInputQuery, debouncedRiotIdInput]);

  const searchSuggestionsOptions = trpcClient.player.searchRiotIds.queryOptions(
    {
        query: searchInputQuery,
        platformId: selectedRegion,
        limit: 5,
    },
    {
        enabled: isInputValidForSearch && showSuggestions, 
        staleTime: 60 * 1000, // 1 minute
        gcTime: 5 * 60 * 1000, // 5 minutes
        refetchOnWindowFocus: false,
    }
  );
  const { data: suggestions, isLoading: isLoadingSuggestions } = useQuery(searchSuggestionsOptions);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (
          inputRef.current && !inputRef.current.contains(event.target as Node) &&
          suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)
        ) {
          setShowSuggestions(false);
        }
      };
      document.addEventListener('mouseup', handleClickOutside);
      return () => { document.removeEventListener('mouseup', handleClickOutside); };
    }, []);

  useEffect(() => {
      if (!isInputValidForSearch) {
        setShowSuggestions(false); 
      }
      // Invalidate suggestions when region changes or input becomes valid/invalid for search
      queryClient.invalidateQueries({ queryKey: searchSuggestionsOptions.queryKey });
    }, [selectedRegion, isInputValidForSearch, queryClient, searchSuggestionsOptions.queryKey]);


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setRiotIdInput(value);
    setFormError(null); // Clear previous errors
    // Show suggestions if the part before '#' is >= 2 chars and there's no '#' yet
    setShowSuggestions(value.split('#')[0].trim().length >= 2 && !value.includes('#'));
  };

  const handleInputFocus = () => {
      const currentQuery = riotIdInput.split('#')[0].trim();
      if (currentQuery.length >= 2 && !riotIdInput.includes('#')) {
          setShowSuggestions(true);
      }
  }

  const handleSuggestionClick = (suggestion: RiotIdSuggestion) => {
    const fullRiotId = `${suggestion.gameName}#${suggestion.tagLine}`;
    setRiotIdInput(fullRiotId); 
    setShowSuggestions(false); 
    navigateToProfile(suggestion.gameName, suggestion.tagLine, selectedRegion);
  };

  const navigateToProfile = (gameName: string, tagLine: string, region: string) => {
     if (gameName && tagLine && region) {
        setIsNavigating(true);
        const combinedRiotId = `${gameName}-${tagLine}`; 
        const profilePath = `/profile/${encodeURIComponent(region)}/${encodeURIComponent(combinedRiotId)}`;
        router.push(profilePath);
     } else {
        setFormError("Invalid suggestion data.");
        setIsNavigating(false);
     }
   }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setShowSuggestions(false); 
    const currentInput = riotIdInput.trim();
    if (!currentInput) { setFormError("Please enter a Riot ID (e.g., PlayerName#TAG)."); return; }
    if (!currentInput.includes('#')) { setFormError("Invalid Riot ID format. Must include '#'."); return; }
    const parts = currentInput.split('#');
    if (parts.length !== 2 || !parts[0].trim() || !parts[1].trim()) { setFormError("Invalid Riot ID format. Name and tag required."); return; }
    const gameName = parts[0].trim();
    const tagLine = parts[1].trim();
    navigateToProfile(gameName, tagLine, selectedRegion);
  };
  
  const shouldRenderSuggestionsDropdown = showSuggestions && isInputValidForSearch && (isLoadingSuggestions || (suggestions && suggestions.length > 0));

  // Define rows for the region buttons
  const regionRow1 = regions.slice(0, 8);
  const regionRow2 = regions.slice(8, 15); // 7 regions for the second row

  return (
    <div className="w-full relative"> 
      <form onSubmit={handleSubmit} className="space-y-6">
        {formError && (
            <Alert variant="destructive" className="bg-red-900/70 border-red-700 text-red-100">
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>Input Error</AlertTitle>
                <AlertDescription>{formError}</AlertDescription>
            </Alert>
        )}

        {/* Region Buttons - 8-7 Layout */}
        <div className="mb-6">
            <p className="text-sm text-slate-300 mb-2 font-medium text-center">Select Region</p>
            <div className="flex flex-col items-center gap-1.5">
                {/* First Row (8 buttons) */}
                <div className="flex justify-center gap-1.5 flex-wrap">
                    {regionRow1.map((r) => (
                        <Button
                            key={r.value}
                            type="button"
                            variant={selectedRegion === r.value ? "secondary" : "outline"}
                            size="sm"
                            onClick={() => setSelectedRegion(r.value)}
                            className={`
                                px-3 py-1.5 text-xs font-semibold transition-all duration-150 ease-in-out
                                ${selectedRegion === r.value 
                                    ? 'bg-purple-600 text-purple-50 hover:bg-purple-500 ring-2 ring-purple-400 shadow-lg' 
                                    : 'bg-slate-700/80 border-slate-600 text-slate-200 hover:bg-slate-600/90 hover:text-slate-50 hover:border-slate-500'
                                }
                            `}
                        >
                            {r.label}
                        </Button>
                    ))}
                </div>
                {/* Second Row (7 buttons - centered) */}
                <div className="flex justify-center gap-1.5 flex-wrap">
                     {regionRow2.map((r) => (
                        <Button
                            key={r.value}
                            type="button"
                            variant={selectedRegion === r.value ? "secondary" : "outline"}
                            size="sm"
                            onClick={() => setSelectedRegion(r.value)}
                            className={`
                                px-3 py-1.5 text-xs font-semibold transition-all duration-150 ease-in-out
                                ${selectedRegion === r.value 
                                    ? 'bg-purple-600 text-purple-50 hover:bg-purple-500 ring-2 ring-purple-400 shadow-lg' 
                                    : 'bg-slate-700/80 border-slate-600 text-slate-200 hover:bg-slate-600/90 hover:text-slate-50 hover:border-slate-500'
                                }
                            `}
                        >
                            {r.label}
                        </Button>
                    ))}
                </div>
            </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 items-start"> 
          <div className="flex-grow space-y-1 relative w-full sm:w-auto"> 
            <label htmlFor="riotId" className="sr-only">Riot ID</label>
            <div className="relative">
                <Input
                    ref={inputRef} id="riotId" placeholder="Enter Riot ID (e.g., PlayerName#TAG)"
                    value={riotIdInput}
                    onChange={handleInputChange}
                    onFocus={handleInputFocus}
                    className="h-12 text-lg bg-slate-800/80 border-purple-500/60 text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition duration-150 ease-in-out rounded-md pr-10"
                    required aria-label="Riot ID Input" autoComplete="off"
                />
                {riotIdInput && (
                    <Button
                        type="button" variant="ghost" size="sm"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0 text-gray-400 hover:text-white"
                        onClick={() => { setRiotIdInput(''); setShowSuggestions(false); inputRef.current?.focus(); }}
                        aria-label="Clear input"
                    > <X className="h-4 w-4" /> </Button>
                )}
            </div>
            {shouldRenderSuggestionsDropdown && (
              <ul
                ref={suggestionsRef}
                className="absolute z-20 w-full mt-1 bg-slate-800 border border-purple-500/60 rounded-md shadow-lg max-h-60 overflow-y-auto"
              >
                {isLoadingSuggestions && (
                    <li className="px-4 py-3 text-gray-400 flex items-center"> <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading suggestions... </li>
                )}
                {!isLoadingSuggestions && suggestions && suggestions.length === 0 && searchInputQuery.length > 0 && (
                     <li className="px-4 py-3 text-gray-400 text-sm italic">No recent players found matching &quot;{searchInputQuery}&quot;.</li>
                )}
                {!isLoadingSuggestions && suggestions && suggestions.map((suggestion: RiotIdSuggestion) => {
                    return (
                        <li
                            key={suggestion.puuid}
                            className="px-3 py-2.5 text-white hover:bg-purple-700/60 cursor-pointer text-sm flex items-center gap-2.5 transition-colors"
                            onMouseDown={() => handleSuggestionClick(suggestion)} 
                        >
                            <Image
                                src={getSuggestionProfileIconUrl(suggestion.profileIconId, currentPatchVersion)}
                                alt="" 
                                width={24}
                                height={24}
                                className="w-6 h-6 rounded-sm shrink-0"
                                onError={(e) => { e.currentTarget.src = 'https://placehold.co/24x24/374151/9CA3AF?text=?'; }}
                            />
                            <div className="overflow-hidden whitespace-nowrap text-ellipsis">
                                {suggestion.gameName.toLowerCase().startsWith(searchInputQuery.toLowerCase()) ? (
                                    <>
                                        <span className="font-semibold text-purple-300">{suggestion.gameName.substring(0, searchInputQuery.length)}</span>
                                        <span>{suggestion.gameName.substring(searchInputQuery.length)}</span>
                                    </>
                                ) : ( <span>{suggestion.gameName}</span> )}
                                <span className="text-gray-400 text-xs"> #{suggestion.tagLine}</span>
                            </div>
                        </li>
                    );
                })}
              </ul>
            )}
          </div>

          <Button type="submit" className="w-full sm:w-auto h-12 text-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold shadow-lg transition duration-150 ease-in-out rounded-md cursor-pointer px-6 shrink-0" disabled={isNavigating}>
            {isNavigating ? ( <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Searching...</> ) : ( <><Search className="mr-2 h-5 w-5" /> Search</> )}
          </Button>
        </div>
      </form>
    </div>
  );
}
