// src/types/ddragon.ts

// --- Data Dragon Specific Types ---
export interface DDragonImage {
    full: string;
    sprite: string;
    group: string;
    x: number;
    y: number;
    w: number;
    h: number;
  }
  
  export interface DDragonGold {
    base: number;
    purchasable: boolean;
    total: number;
    sell: number;
  }
  
  export interface DDragonItem {
    name: string;
    description: string; 
    colloq: string;
    plaintext: string;
    into?: string[]; 
    from?: string[]; 
    image: DDragonImage;
    gold: DDragonGold;
    tags: string[];
    maps: Record<string, boolean>; 
    stats: Record<string, number>; 
    depth?: number; 
    effect?: Record<string, string>;
    stacks?: number;
    consumed?: boolean;
    consumeOnFull?: boolean;
    inStore?: boolean;
    hideFromAll?: boolean;
    requiredChampion?: string;
    requiredAlly?: string;
    specialRecipe?: number;
    isEnchantment?: boolean;
  }
  
  export interface DDragonSummonerSpell { 
    id: string; 
    name: string; 
    description: string; 
    key: string; 
    image: DDragonImage; 
    cooldownBurn?: string; 
    costBurn?: string; 
    costType?: string; 
    maxrank?: number; 
    rangeBurn?: string; 
    tooltip?: string; 
  }
  
  export interface DDragonRune { 
    id: number; 
    key: string; 
    icon: string; 
    name: string; 
    shortDesc?: string; 
    longDesc?: string; 
  }
  
  export interface DDragonRuneTree { 
    id: number; 
    key: string; 
    icon: string; 
    name: string; 
    slots: { runes: DDragonRune[] }[]; 
  }
  
  export interface DDragonChampion { 
    version: string; 
    id: string; 
    key: string; 
    name: string; 
    title: string; 
    image: DDragonImage; 
  }
  
  export interface DDragonQueue { 
    queueId: number; 
    map: string; 
    description?: string | null; 
    notes?: string | null; 
  }
  
  export interface DDragonArenaAugment { 
    id: number; 
    name: string; 
    apiName?: string; 
    desc?: string; 
    tooltip?: string; 
    iconLarge?: string; 
    iconSmall?: string; 
    iconPath?: string; 
    rarity?: number; 
    dataValues?: Record<string, number>; 
    calculations?: Record<string, any>; 
    spellTags?: string[]; 
    championSpecific?: string; 
  }
  
  export interface DDragonDataBundle {
    summonerSpellData: Record<string, DDragonSummonerSpell> | null;
    runeTreeData: DDragonRuneTree[] | null;
    championData: Record<string, DDragonChampion> | null;
    itemData?: Record<string, DDragonItem> | null; 
    gameModeMap: Record<number, string> | null;
    arenaAugmentData?: Record<number, DDragonArenaAugment> | null;
  }
  
  // --- Riot API Related Types ---
  
  export interface RiotSummonerDTO {
      id: string; 
      accountId: string; 
      puuid: string; 
      name: string; 
      profileIconId: number;
      revisionDate: number; 
      summonerLevel: number;
  }
  
  export interface LeagueEntryDTO {
      leagueId: string;
      summonerId: string; 
      summonerName: string;
      queueType: string; 
      tier: string; 
      rank: string; 
      leaguePoints: number;
      wins: number;
      losses: number;
      hotStreak: boolean;
      veteran: boolean;
      freshBlood: boolean;
      inactive: boolean;
      miniSeries?: MiniSeriesDTO; 
  }
  export interface MiniSeriesDTO {
      losses: number;
      progress: string; 
      target: number; 
      wins: number;
  }
  
  export interface ChampionMasteryDTO {
    puuid: string;                       
    championId: number;                  
    championLevel: number;               
    championPoints: number;              
    lastPlayTime: number;                
    championPointsSinceLastLevel: number; 
    championPointsUntilNextLevel: number; 
    chestGranted: boolean;               
    tokensEarned: number;                
    summonerId: string;                  
  }
  
  export interface PerkStatsDto { defense: number; flex: number; offense: number; }
  export interface PerkStyleSelectionDto { perk: number; var1: number; var2: number; var3: number; }
  export interface PerkStyleDto { description: string; selections: PerkStyleSelectionDto[]; style: number; }
  export interface PerksDto { statPerks: PerkStatsDto; styles: PerkStyleDto[]; }
  
  export interface MatchParticipantStats {
    participantId: number;
    puuid: string;
    riotIdGameName?: string;
    riotIdTagline?: string;
    summonerName: string; 
    championName: string;
    championId: number;
    champLevel: number;
    teamId: number;
    win: boolean;
    kills: number;
    deaths: number;
    assists: number;
    item0: number; item1: number; item2: number; item3: number; item4: number; item5: number; item6: number; 
    summoner1Id: number;
    summoner2Id: number;
    goldEarned: number;
    goldSpent: number;
    totalMinionsKilled: number;
    neutralMinionsKilled: number;
    visionScore: number;
    wardsPlaced?: number; // Made optional as per some API versions or game modes
    visionWardsBoughtInGame?: number; 
    totalDamageDealtToChampions: number;
    damageDealtToObjectives: number;
    damageDealtToTurrets?: number; // Made optional, present in your JSON
    pentaKills: number;
    quadraKills: number;
    tripleKills: number;
    doubleKills: number;
    perks?: PerksDto; 
    teamPosition?: string; 
    individualPosition?: string; 
    timePlayed?: number;
    totalDamageTaken?: number;
    trueDamageDealtToChampions?: number;
    playerSubteamId?: number; 
    subteamPlacement?: number; 
    playerAugment1?: number; 
    playerAugment2?: number; 
    playerAugment3?: number; 
    playerAugment4?: number; 
    profileIcon: number; 
    gameEndedInEarlySurrender?: boolean; 
    gameEndedInSurrender?: boolean;    
    champExperience?: number;
    championTransform?: number;
    consumablesPurchased?: number;
    damageSelfMitigated?: number; // Ensured it's optional or number
    detectorWardsPlaced?: number;
    firstBloodAssist?: boolean;
    firstBloodKill?: boolean;
    firstTowerAssist?: boolean;
    firstTowerKill?: boolean;
    inhibitorKills?: number;
    inhibitorTakedowns?: number;
    inhibitorsLost?: number;
    itemsPurchased?: number;
    killingSprees?: number;
    largestCriticalStrike?: number;
    largestKillingSpree?: number;
    largestMultiKill?: number;
    longestTimeSpentLiving?: number;
    magicDamageDealt?: number;
    magicDamageDealtToChampions?: number;
    magicDamageTaken?: number;
    nexusKills?: number;
    nexusLost?: number;
    nexusTakedowns?: number;
    objectivesStolen?: number;
    objectivesStolenAssists?: number;
    physicalDamageDealt?: number;
    physicalDamageDealtToChampions?: number;
    physicalDamageTaken?: number;
    sightWardsBoughtInGame?: number;
    spell1Casts?: number;
    spell2Casts?: number;
    spell3Casts?: number;
    spell4Casts?: number;
    summoner1Casts?: number;
    summoner2Casts?: number;
    timeCCingOthers?: number;
    totalAllyJungleMinionsKilled?: number;
    totalDamageDealt?: number; // Ensured it's optional or number
    totalDamageShieldedOnTeammates?: number;
    totalEnemyJungleMinionsKilled?: number;
    totalHeal?: number;
    totalHealsOnTeammates?: number;
    totalTimeCCDealt?: number;
    totalTimeSpentDead?: number;
    totalUnitsHealed?: number;
    trueDamageDealt?: number;
    trueDamageTaken?: number;
    turretKills?: number;
    turretTakedowns?: number;
    turretsLost?: number;
    unrealKills?: number;
    wardsKilled?: number;
    challenges?: Record<string, any>; // Kept as 'any' for brevity, can be typed out fully
  }
  
  export interface BanDto { championId: number; pickTurn: number; }
  export interface ObjectiveDto { first: boolean; kills: number; }
  export interface ObjectivesDto { 
    baron: ObjectiveDto; 
    champion: ObjectiveDto; 
    dragon: ObjectiveDto; 
    inhibitor: ObjectiveDto; 
    riftHerald: ObjectiveDto; 
    tower: ObjectiveDto; 
    atakhan?: ObjectiveDto; 
    horde?: ObjectiveDto;   
  }
  export interface TeamDto { 
    teamId: number; 
    win: boolean; 
    bans: BanDto[]; 
    objectives: ObjectivesDto; 
    feats?: Record<string, { featState: number }>; 
  }
  export interface MatchInfoData { 
      endOfGameResult?: string; 
      gameCreation: number; 
      gameDuration: number; 
      gameEndTimestamp?: number; 
      gameId: number;
      gameMode: string; 
      gameName: string; 
      gameType: string; 
      gameVersion: string;
      mapId: number; 
      participants: MatchParticipantStats[]; 
      platformId: string;
      queueId: number; 
      teams: TeamDto[]; 
      tournamentCode?: string;
      gameStartTimestamp?: number; 
  }
  
  export interface MatchDetailsData {
    metadata: { matchId: string; participants: string[]; dataVersion: string; };
    info: MatchInfoData; 
    fetchedFrom?: string;
  }
  
  // --- End Riot API Types ---
  