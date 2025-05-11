// src/lib/db/schema.ts
import { bigint, jsonb, pgTable, primaryKey, text, uniqueIndex } from 'drizzle-orm/pg-core';
// import { relations } from 'drizzle-orm'; // Keep if you plan to use Drizzle relations

// Existing playerCache table (stores summoner data by PUUID)
export const playerCache = pgTable('player_cache', {
  puuid: text('puuid').primaryKey(),
  data: jsonb('data').notNull(), // Stores the JSON response from SUMMONER-V4 by PUUID
  lastFetched: bigint('last_fetched', { mode: 'number' }).notNull(),
  region: text('region'), // PlatformId like 'na1', 'euw1'
  // Store last known Riot ID with this PUUID for quick reference/update checks
  lastKnownGameName: text('last_known_game_name'),
  lastKnownTagLine: text('last_known_tag_line'),
});

// New table to cache Riot ID (gameName#tagLine) to PUUID mappings
export const riotIdCache = pgTable('riot_id_cache', {
  gameName: text('game_name').notNull(),
  tagLine: text('tag_line').notNull(),
  platformId: text('platform_id').notNull(),
  puuid: text('puuid').notNull(),
  lastVerified: bigint('last_verified', { mode: 'number' }).notNull(),
}, (table) => {
  // UPDATED: Return an array for table extras
  return [
    primaryKey({ name: 'riot_id_cache_pk', columns: [table.gameName, table.tagLine, table.platformId] }),
    uniqueIndex('riot_id_puuid_idx').on(table.puuid),
  ];
});

// New table to store lists of match IDs for a PUUID
export const playerMatchIds = pgTable('player_match_ids', {
  puuid: text('puuid').notNull(),
  matchApiRegion: text('match_api_region').notNull(), // e.g., 'americas', 'europe'
  matchIds: jsonb('match_ids').$type<string[]>().notNull(),
  lastFetched: bigint('last_fetched', { mode: 'number' }).notNull(),
}, (table) => {
  // UPDATED: Return an array for table extras
  return [
    primaryKey({ name: 'player_match_ids_pk', columns: [table.puuid, table.matchApiRegion] }),
  ];
});

// New table to store detailed match data for individual matches
export const matchDetails = pgTable('match_details', {
  matchId: text('match_id').primaryKey(),
  matchApiRegion: text('match_api_region').notNull(), // e.g., 'americas', 'europe'
  data: jsonb('data').notNull(), // Stores the full MatchDto JSON response
  lastFetched: bigint('last_fetched', { mode: 'number' }).notNull(),
});

// --- Relations (Optional but good for ORM-style queries if needed) ---
// Example:
// export const playerCacheRelations = relations(playerCache, ({ many }) => ({
//   matchListsAssociated: many(playerMatchIds, {
//     relationName: 'PlayerMatchLists',
//     fields: [playerCache.puuid],
//     references: [playerMatchIds.puuid]
//   }),
// }));

// export const riotIdCacheRelations = relations(riotIdCache, ({ one }) => ({
//   playerProfile: one(playerCache, {
//     relationName: 'CachedPlayerProfileFromRiotId',
//     fields: [riotIdCache.puuid],
//     references: [playerCache.puuid]
//   }),
// }));
