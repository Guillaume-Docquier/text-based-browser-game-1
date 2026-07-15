ALTER TYPE "public"."action_type" ADD VALUE 'BUILD_UNIT';--> statement-breakpoint
CREATE TABLE "units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" integer NOT NULL,
	"player_id" uuid NOT NULL,
	"sector_id" uuid,
	"body_id" uuid,
	CONSTRAINT "units_location_check" CHECK (("units"."sector_id" is not null) <> ("units"."body_id" is not null))
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "destination_sector_id" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "destination_body_id" uuid;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_game_id_player_id_players_fk" FOREIGN KEY ("game_id","player_id") REFERENCES "public"."players"("game_id","player_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_game_id_sector_id_sectors_fk" FOREIGN KEY ("game_id","sector_id") REFERENCES "public"."sectors"("game_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_game_id_body_id_bodies_fk" FOREIGN KEY ("game_id","body_id") REFERENCES "public"."bodies"("game_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "units_game_id_idx" ON "units" USING btree ("game_id");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_game_id_destination_sector_id_sectors_fk" FOREIGN KEY ("game_id","destination_sector_id") REFERENCES "public"."sectors"("game_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_game_id_destination_body_id_bodies_fk" FOREIGN KEY ("game_id","destination_body_id") REFERENCES "public"."bodies"("game_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_action_destination_check" CHECK ((
        "orders"."action_type"::text = 'BUILD_UNIT'
        and (("orders"."destination_sector_id" is not null) <> ("orders"."destination_body_id" is not null))
      ) or (
        "orders"."action_type"::text in ('MAKE_MORE_MONEY', 'WIN_THE_GAME')
        and "orders"."destination_sector_id" is null
        and "orders"."destination_body_id" is null
      ));
