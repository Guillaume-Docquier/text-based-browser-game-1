CREATE TABLE "game_settings" (
	"game_id" integer PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"star_system_generation_settings" jsonb NOT NULL,
	"nbSeats" integer NOT NULL,
	"tickIntervalSeconds" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "game_settings" ADD CONSTRAINT "game_settings_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" DROP COLUMN "name";--> statement-breakpoint
ALTER TABLE "games" DROP COLUMN "nbSeats";--> statement-breakpoint
ALTER TABLE "games" DROP COLUMN "tickIntervalSeconds";--> statement-breakpoint
ALTER TABLE "star_systems" DROP COLUMN "generation_settings";