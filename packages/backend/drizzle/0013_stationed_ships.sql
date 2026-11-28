CREATE TYPE "public"."ship_type" AS ENUM('TRANSPORT');--> statement-breakpoint
CREATE TABLE "ships" (
	"game_id" integer NOT NULL,
	"id" text NOT NULL,
	"type" "ship_type" NOT NULL,
	"owner_player_id" uuid NOT NULL,
	"planet_id" text NOT NULL,
	CONSTRAINT "ships_game_id_id_pk" PRIMARY KEY("game_id","id")
);
--> statement-breakpoint
ALTER TABLE "ships" ADD CONSTRAINT "ships_game_id_owner_player_id_players_game_id_player_id_fk" FOREIGN KEY ("game_id","owner_player_id") REFERENCES "public"."players"("game_id","player_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ships" ADD CONSTRAINT "ships_game_id_planet_id_planets_game_id_id_fk" FOREIGN KEY ("game_id","planet_id") REFERENCES "public"."planets"("game_id","id") ON DELETE cascade ON UPDATE no action;