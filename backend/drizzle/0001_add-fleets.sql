CREATE TABLE "fleets" (
	"id" text PRIMARY KEY NOT NULL,
	"game_id" integer NOT NULL,
	"player_id" uuid NOT NULL,
	"strength" integer NOT NULL,
	"origin_planet_id" integer NOT NULL,
	CONSTRAINT "fleets_game_id_player_id_origin_planet_id_unique" UNIQUE("game_id","player_id","origin_planet_id"),
	CONSTRAINT "fleets_strength_positive_check" CHECK ("fleets"."strength" > 0)
);
--> statement-breakpoint
ALTER TABLE "fleets" ADD CONSTRAINT "fleets_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleets" ADD CONSTRAINT "fleets_gameId_playerId_game_players_fk" FOREIGN KEY ("game_id","player_id") REFERENCES "public"."players"("game_id","player_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleets" ADD CONSTRAINT "fleets_gameId_originPlanetId_planets_fk" FOREIGN KEY ("game_id","origin_planet_id") REFERENCES "public"."planets"("game_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fleets_game_id_origin_planet_id_idx" ON "fleets" USING btree ("game_id","origin_planet_id");