CREATE TABLE "player_cache" (
	"puuid" text PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"last_fetched" bigint NOT NULL,
	"region" text
);
