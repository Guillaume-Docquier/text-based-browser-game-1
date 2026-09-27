ALTER TABLE "fleets" RENAME COLUMN "player_id" TO "owner_player_id";--> statement-breakpoint
ALTER TABLE "fleets" DROP CONSTRAINT "fleets_game_id_player_id_origin_planet_id_unique";--> statement-breakpoint
ALTER TABLE "fleets" DROP CONSTRAINT "fleets_gameId_playerId_game_players_fk";
--> statement-breakpoint
ALTER TABLE "fleets" ADD CONSTRAINT "fleets_gameId_ownerPlayerId_game_players_fk" FOREIGN KEY ("game_id","owner_player_id") REFERENCES "public"."players"("game_id","player_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleets" ADD CONSTRAINT "fleets_game_id_owner_player_id_origin_planet_id_unique" UNIQUE("game_id","owner_player_id","origin_planet_id");