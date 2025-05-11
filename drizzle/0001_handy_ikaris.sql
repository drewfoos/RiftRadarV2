CREATE TABLE "match_details" (
	"match_id" text PRIMARY KEY NOT NULL,
	"match_api_region" text NOT NULL,
	"data" jsonb NOT NULL,
	"last_fetched" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_match_ids" (
	"puuid" text NOT NULL,
	"match_api_region" text NOT NULL,
	"match_ids" jsonb NOT NULL,
	"last_fetched" bigint NOT NULL,
	CONSTRAINT "player_match_ids_pk" PRIMARY KEY("puuid","match_api_region")
);
--> statement-breakpoint
CREATE TABLE "riot_id_cache" (
	"game_name" text NOT NULL,
	"tag_line" text NOT NULL,
	"platform_id" text NOT NULL,
	"puuid" text NOT NULL,
	"last_verified" bigint NOT NULL,
	CONSTRAINT "riot_id_cache_pk" PRIMARY KEY("game_name","tag_line","platform_id")
);
--> statement-breakpoint
ALTER TABLE "player_cache" ADD COLUMN "last_known_game_name" text;--> statement-breakpoint
ALTER TABLE "player_cache" ADD COLUMN "last_known_tag_line" text;--> statement-breakpoint
CREATE UNIQUE INDEX "riot_id_puuid_idx" ON "riot_id_cache" USING btree ("puuid");