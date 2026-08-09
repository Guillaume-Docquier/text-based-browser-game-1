CREATE TYPE "public"."planet_biome" AS ENUM('OCEANIC', 'METALLIC', 'FROZEN', 'VOLCANIC');--> statement-breakpoint
CREATE TYPE "public"."planet_size" AS ENUM('SMALL', 'MEDIUM', 'LARGE');--> statement-breakpoint
ALTER TABLE "planets" ADD COLUMN "biome" "planet_biome" NOT NULL;--> statement-breakpoint
ALTER TABLE "planets" ADD COLUMN "size" "planet_size" NOT NULL;--> statement-breakpoint
ALTER TABLE "planets" ADD COLUMN "fertility" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "planets" ADD COLUMN "metal" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "planets" ADD COLUMN "fuel" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "planets" ADD COLUMN "energy" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "planets" ADD COLUMN "max_population" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "planets" ADD COLUMN "area" integer NOT NULL;