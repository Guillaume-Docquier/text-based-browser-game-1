ALTER TABLE "fleets" ADD COLUMN "destination_planet_id" text;--> statement-breakpoint
ALTER TABLE "fleets" ADD COLUMN "distance_to_end" double precision;--> statement-breakpoint
ALTER TABLE "fleets" ADD CONSTRAINT "fleets_gameId_destinationPlanetId_planets_fk" FOREIGN KEY ("game_id","destination_planet_id") REFERENCES "public"."planets"("game_id","id") ON DELETE cascade ON UPDATE no action;