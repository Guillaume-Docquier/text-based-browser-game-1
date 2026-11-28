CREATE TYPE "public"."building_type" AS ENUM('COMMAND_CENTER');--> statement-breakpoint
CREATE TABLE "buildings" (
	"game_id" integer NOT NULL,
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"type" "building_type" NOT NULL,
	"planet_id" text NOT NULL,
	"site" integer NOT NULL,
	CONSTRAINT "buildings_game_id_id_pk" PRIMARY KEY("game_id","id"),
	CONSTRAINT "buildings_one_per_site" UNIQUE("game_id","planet_id","site")
);
--> statement-breakpoint
ALTER TABLE "buildings" ADD CONSTRAINT "buildings_game_id_planet_id_planets_game_id_id_fk" FOREIGN KEY ("game_id","planet_id") REFERENCES "public"."planets"("game_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "buildings_one_command_center_per_planet" ON "buildings" USING btree ("game_id","planet_id") WHERE "buildings"."type" = 'COMMAND_CENTER';