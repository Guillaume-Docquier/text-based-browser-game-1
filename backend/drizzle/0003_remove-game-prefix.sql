ALTER TABLE "game_player_actions" RENAME TO "orders";--> statement-breakpoint
ALTER TABLE "game_player_resources" RENAME TO "resources";--> statement-breakpoint
ALTER TABLE "game_ticks" RENAME TO "ticks";--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT "game_player_actions_gameId_playerId_game_players_fk";
--> statement-breakpoint
ALTER TABLE "resources" DROP CONSTRAINT "game_player_resources_gameId_playerId_game_players_fk";
--> statement-breakpoint
ALTER TABLE "ticks" DROP CONSTRAINT "game_ticks_game_id_games_id_fk";
--> statement-breakpoint
DROP INDEX "game_ticks_scheduled_for_index";--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT "game_player_actions_game_id_player_id_tick_pk";--> statement-breakpoint
ALTER TABLE "resources" DROP CONSTRAINT "game_player_resources_game_id_player_id_resource_type_pk";--> statement-breakpoint
ALTER TABLE "ticks" DROP CONSTRAINT "game_ticks_game_id_tick_pk";--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_game_id_player_id_tick_pk" PRIMARY KEY("game_id","player_id","tick");--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_game_id_player_id_resource_type_pk" PRIMARY KEY("game_id","player_id","resource_type");--> statement-breakpoint
ALTER TABLE "ticks" ADD CONSTRAINT "ticks_game_id_tick_pk" PRIMARY KEY("game_id","tick");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_gameId_playerId_game_players_fk" FOREIGN KEY ("game_id","player_id") REFERENCES "public"."players"("game_id","player_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_gameId_playerId_game_players_fk" FOREIGN KEY ("game_id","player_id") REFERENCES "public"."players"("game_id","player_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticks" ADD CONSTRAINT "ticks_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ticks_scheduled_for_index" ON "ticks" USING btree ("scheduled_for");