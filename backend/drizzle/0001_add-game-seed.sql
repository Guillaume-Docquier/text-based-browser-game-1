ALTER TABLE "planets" ALTER COLUMN "id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "planets" ALTER COLUMN "name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "planets" ALTER COLUMN "coordinates" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "planets" ALTER COLUMN "x" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "planets" ALTER COLUMN "y" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "stars" ALTER COLUMN "id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "stars" ALTER COLUMN "name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "stars" ALTER COLUMN "coordinates" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "stars" ALTER COLUMN "x" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "stars" ALTER COLUMN "y" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "seed" bigint NOT NULL;