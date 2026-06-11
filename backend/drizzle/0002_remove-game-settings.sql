DROP TABLE "game_settings" CASCADE;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "name" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "nb_seats" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "star_system_generation_settings" jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "tick_interval_seconds" integer NOT NULL;