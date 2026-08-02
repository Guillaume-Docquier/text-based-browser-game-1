ALTER TYPE "public"."game_status" RENAME VALUE 'COLLECTING_ORDERS' TO 'COLLECTING_ACTIONS';--> statement-breakpoint
ALTER TABLE "orders" RENAME TO "game_player_actions";--> statement-breakpoint
ALTER TABLE "game_player_actions" RENAME CONSTRAINT "orders_gameId_playerId_game_players_fk" TO "game_player_actions_gameId_playerId_game_players_fk";--> statement-breakpoint
ALTER TABLE "game_player_actions" RENAME CONSTRAINT "orders_game_id_player_id_turn_pk" TO "game_player_actions_game_id_player_id_turn_pk";
