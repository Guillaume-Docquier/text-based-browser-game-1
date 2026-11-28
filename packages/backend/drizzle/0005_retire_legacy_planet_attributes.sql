ALTER TABLE "planets" ALTER COLUMN "metal_production" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "planets" ALTER COLUMN "remaining_metal_deposit" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "planets" DROP COLUMN "fertility";--> statement-breakpoint
ALTER TABLE "planets" DROP COLUMN "metal";--> statement-breakpoint
ALTER TABLE "planets" DROP COLUMN "fuel";--> statement-breakpoint
ALTER TABLE "planets" DROP COLUMN "energy";--> statement-breakpoint
ALTER TABLE "planets" DROP COLUMN "max_population";