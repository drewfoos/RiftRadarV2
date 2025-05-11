// src/types/spectatorV5.ts

/**
 * Information about a banned champion
 */
export interface BannedChampion {
    pickTurn: number;       // The turn during which the champion was banned
    championId: number;     // The ID of the banned champion
    teamId: number;         // The ID of the team that banned the champion
  }
  
  /**
   * Observer information for a game
   */
  export interface Observer {
    encryptionKey: string;  // Key used to decrypt the spectator grid game data for playback
  }
  
  /**
   * Perk/Runes Reforged Information for a participant
   */
  export interface Perks {
    perkIds: number[];      // IDs of the perks/runes assigned.
    perkStyle: number;      // Primary runes path
    perkSubStyle: number;   // Secondary runes path
  }
  
  /**
   * Game Customization Object
   */
  export interface GameCustomizationObject {
    category: string;       // Category identifier for Game Customization
    content: string;        // Game Customization content
  }
  
  /**
   * Information about a participant in the current game
   */
  export interface CurrentGameParticipant {
    championId: number;                 // The ID of the champion played by this participant
    perks?: Perks;                      // Perks/Runes Reforged Information (Optional as per some API versions)
    profileIconId: number;              // The ID of the profile icon used by this participant
    bot: boolean;                       // Flag indicating whether or not this participant is a bot
    teamId: number;                     // The team ID of this participant, indicating the participant's team
    summonerName?: string;              // The summoner name of this participant (Not in spec, but often present)
    riotId?: string; 
    summonerId: string;                 // The encrypted summoner ID of this participant
    puuid: string;                      // The encrypted puuid of this participant
    spell1Id: number;                   // The ID of the first summoner spell used by this participant
    spell2Id: number;                   // The ID of the second summoner spell used by this participant
    gameCustomizationObjects?: GameCustomizationObject[]; // List of Game Customizations (Optional)
  }
  
  /**
   * Information about the current game a summoner is in
   */
  export interface CurrentGameInfo {
    gameId: number;                     // The ID of the game
    gameType: string;                   // The game type (e.g., "CUSTOM_GAME", "MATCHED_GAME", "TUTORIAL_GAME")
    gameStartTime: number;              // The game start time represented in epoch milliseconds
    mapId: number;                      // The ID of the map
    gameLength: number;                 // The amount of time in seconds that has passed since the game started
    platformId: string;                 // The ID of the platform on which the game is being played
    gameMode: string;                   // The game mode (e.g., "CLASSIC", "ODIN", "ARAM", "TUTORIAL", "URF", "DOOMBOTSTEEMO", "ONEFORALL", "ASCENSION", "FIRSTBLOOD", "KINGPORO", "SIEGE", "ASSASSINATE", "ARSR", "DARKSTAR", "STARGUARDIAN", "PROJECT", "GAMEMODEX", "ODYSSEY", "NEXUSBLITZ", "ULTBOOK", "CHERRY")
    bannedChampions: BannedChampion[];    // Banned champion information
    gameQueueConfigId?: number;         // The queue type (queue types are documented on the Game Constants page) (Optional as per some API versions)
    observers: Observer;                // The observer information
    participants: CurrentGameParticipant[]; // The participant information
  }
  
  // You might also want a type for the API error response if the player is not in a game (typically a 404)
  // For example:
  export interface SpectatorApiError {
    status: {
      message: string;
      status_code: number;
    };
  }
  