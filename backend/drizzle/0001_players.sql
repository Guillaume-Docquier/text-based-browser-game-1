ALTER TABLE "game_players" RENAME TO "players";--> statement-breakpoint
ALTER TABLE "game_player_actions" DROP CONSTRAINT "game_player_actions_gameId_playerId_game_players_fk";
--> statement-breakpoint
ALTER TABLE "game_player_resources" DROP CONSTRAINT "game_player_resources_gameId_playerId_game_players_fk";
--> statement-breakpoint
ALTER TABLE "players" DROP CONSTRAINT "game_players_game_id_games_id_fk";
--> statement-breakpoint
ALTER TABLE "players" DROP CONSTRAINT "game_players_player_id_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "players" DROP CONSTRAINT "game_players_game_id_player_id_pk";--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_game_id_player_id_pk" PRIMARY KEY("game_id","player_id");--> statement-breakpoint
ALTER TABLE "game_player_actions" ADD CONSTRAINT "game_player_actions_gameId_playerId_game_players_fk" FOREIGN KEY ("game_id","player_id") REFERENCES "public"."players"("game_id","player_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_player_resources" ADD CONSTRAINT "game_player_resources_gameId_playerId_game_players_fk" FOREIGN KEY ("game_id","player_id") REFERENCES "public"."players"("game_id","player_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_player_id_accounts_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;