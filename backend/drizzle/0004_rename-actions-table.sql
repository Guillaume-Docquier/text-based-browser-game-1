ALTER TABLE "game_player_actions" RENAME TO "actions";--> statement-breakpoint
ALTER TABLE "actions" RENAME CONSTRAINT "game_player_actions_gameId_playerId_game_players_fk" TO "actions_gameId_playerId_game_players_fk";--> statement-breakpoint
ALTER TABLE "actions" RENAME CONSTRAINT "game_player_actions_game_id_player_id_turn_pk" TO "actions_game_id_player_id_turn_pk";
