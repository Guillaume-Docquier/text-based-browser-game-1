ALTER TABLE "movement_edges" ALTER COLUMN "weight" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "sectors" ADD COLUMN "angle_numeric_type" varchar(16) NOT NULL;--> statement-breakpoint
ALTER TABLE "sectors" ADD COLUMN "angle_max_bound_type" varchar(16) NOT NULL;--> statement-breakpoint
ALTER TABLE "sectors" ADD COLUMN "start_angle_degrees" double precision NOT NULL;--> statement-breakpoint
ALTER TABLE "sectors" ADD COLUMN "end_angle_degrees" double precision NOT NULL;--> statement-breakpoint
ALTER TABLE "sectors" ADD CONSTRAINT "sectors_angle_numeric_type_check" CHECK ("sectors"."angle_numeric_type" in ('float', 'integer'));--> statement-breakpoint
ALTER TABLE "sectors" ADD CONSTRAINT "sectors_angle_max_bound_type_check" CHECK ("sectors"."angle_max_bound_type" in ('inclusive', 'exclusive'));--> statement-breakpoint
ALTER TABLE "sectors" ADD CONSTRAINT "sectors_start_angle_degrees_check" CHECK ("sectors"."start_angle_degrees" >= 0);--> statement-breakpoint
ALTER TABLE "sectors" ADD CONSTRAINT "sectors_end_angle_degrees_check" CHECK ("sectors"."end_angle_degrees" <= 360);--> statement-breakpoint
ALTER TABLE "sectors" ADD CONSTRAINT "sectors_angle_degrees_order_check" CHECK ("sectors"."start_angle_degrees" < "sectors"."end_angle_degrees");