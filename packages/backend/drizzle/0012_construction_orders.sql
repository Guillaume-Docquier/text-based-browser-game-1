CREATE TABLE "construction_orders" (
	"game_id" integer NOT NULL,
	"turn" integer NOT NULL,
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"planet_id" text NOT NULL,
	"player_id" uuid NOT NULL,
	"type" "building_type" NOT NULL,
	"site" integer NOT NULL,
	"cost" double precision NOT NULL,
	CONSTRAINT "construction_orders_game_id_id_pk" PRIMARY KEY("game_id","id"),
	CONSTRAINT "construction_orders_one_per_command_center" UNIQUE("game_id","turn","planet_id")
);
--> statement-breakpoint
ALTER TABLE "construction_orders" ADD CONSTRAINT "construction_orders_game_id_turn_turns_game_id_turn_fk" FOREIGN KEY ("game_id","turn") REFERENCES "public"."turns"("game_id","turn") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "construction_orders" ADD CONSTRAINT "construction_orders_game_id_planet_id_planets_game_id_id_fk" FOREIGN KEY ("game_id","planet_id") REFERENCES "public"."planets"("game_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "construction_orders" ADD CONSTRAINT "construction_orders_game_id_player_id_players_game_id_player_id_fk" FOREIGN KEY ("game_id","player_id") REFERENCES "public"."players"("game_id","player_id") ON DELETE cascade ON UPDATE no action;