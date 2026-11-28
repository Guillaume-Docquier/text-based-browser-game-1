-- PostgreSQL permits a new enum type and its values in one transaction. The startup migrator also backfills trade centers in this transaction.
ALTER TYPE "public"."building_type" RENAME TO "building_type_before_trade";
--> statement-breakpoint
CREATE TYPE "public"."building_type" AS ENUM ('COMMAND_CENTER', 'TRADE_CENTER');
--> statement-breakpoint
DROP INDEX "buildings_one_command_center_per_planet";
--> statement-breakpoint
ALTER TABLE "buildings" ALTER COLUMN "type" TYPE "public"."building_type" USING "type"::text::"public"."building_type";
--> statement-breakpoint
CREATE UNIQUE INDEX "buildings_one_command_center_per_planet" ON "buildings" USING btree ("game_id", "planet_id") WHERE "type" = 'COMMAND_CENTER';
--> statement-breakpoint
DROP TYPE "public"."building_type_before_trade";
