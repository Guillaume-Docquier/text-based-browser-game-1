CREATE TABLE "planet_observations" (
	"game_id" integer NOT NULL,
	"player_id" uuid NOT NULL,
	"planet_id" text NOT NULL,
	"observed_turn" integer NOT NULL,
	"facts" jsonb NOT NULL,
	"buildings" jsonb NOT NULL,
	CONSTRAINT "planet_observations_game_id_player_id_planet_id_pk" PRIMARY KEY("game_id","player_id","planet_id")
);
--> statement-breakpoint
ALTER TABLE "planet_observations" ADD CONSTRAINT "planet_observations_game_id_player_id_players_game_id_player_id_fk" FOREIGN KEY ("game_id","player_id") REFERENCES "public"."players"("game_id","player_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planet_observations" ADD CONSTRAINT "planet_observations_game_id_planet_id_planets_game_id_id_fk" FOREIGN KEY ("game_id","planet_id") REFERENCES "public"."planets"("game_id","id") ON DELETE cascade ON UPDATE no action;