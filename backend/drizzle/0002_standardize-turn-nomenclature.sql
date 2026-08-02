ALTER TABLE "ticks" RENAME TO "turns";--> statement-breakpoint
ALTER TABLE "game_states" RENAME COLUMN "tick" TO "turn";--> statement-breakpoint
ALTER TABLE "game_states" RENAME COLUMN "next_tick_at" TO "next_turn_at";--> statement-breakpoint
ALTER TABLE "games" RENAME COLUMN "tick_interval_seconds" TO "turn_interval_seconds";--> statement-breakpoint
ALTER TABLE "orders" RENAME COLUMN "tick" TO "turn";--> statement-breakpoint
ALTER TABLE "turns" RENAME COLUMN "tick" TO "turn";--> statement-breakpoint
ALTER TABLE "turns" DROP CONSTRAINT "ticks_game_id_games_id_fk";
--> statement-breakpoint
ALTER TABLE "games" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "games" ALTER COLUMN "status" SET DEFAULT 'WAITING_FOR_PLAYERS'::text;--> statement-breakpoint
DROP TYPE "public"."game_status";--> statement-breakpoint
CREATE TYPE "public"."game_status" AS ENUM('WAITING_FOR_PLAYERS', 'READY_TO_START', 'COLLECTING_ORDERS', 'PROCESSING_TURN', 'ENDED');--> statement-breakpoint
ALTER TABLE "games" ALTER COLUMN "status" SET DEFAULT 'WAITING_FOR_PLAYERS'::"public"."game_status";--> statement-breakpoint
ALTER TABLE "games" ALTER COLUMN "status" SET DATA TYPE "public"."game_status" USING "status"::"public"."game_status";--> statement-breakpoint
DROP INDEX "ticks_scheduled_for_index";--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT "orders_game_id_player_id_tick_pk";--> statement-breakpoint
ALTER TABLE "turns" DROP CONSTRAINT "ticks_game_id_tick_pk";--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_game_id_player_id_turn_pk" PRIMARY KEY("game_id","player_id","turn");--> statement-breakpoint
ALTER TABLE "turns" ADD CONSTRAINT "turns_game_id_turn_pk" PRIMARY KEY("game_id","turn");--> statement-breakpoint
ALTER TABLE "turns" ADD CONSTRAINT "turns_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "turns_scheduled_for_index" ON "turns" USING btree ("scheduled_for");