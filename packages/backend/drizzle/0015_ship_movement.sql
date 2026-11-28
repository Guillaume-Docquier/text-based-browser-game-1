CREATE TABLE "move_orders" (
	"game_id" integer NOT NULL,
	"turn" integer NOT NULL,
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"ship_id" text NOT NULL,
	"player_id" uuid NOT NULL,
	"route" jsonb NOT NULL,
	CONSTRAINT "move_orders_game_id_id_pk" PRIMARY KEY("game_id","id"),
	CONSTRAINT "one_move_per_ship_per_turn" UNIQUE("game_id","turn","ship_id")
);
--> statement-breakpoint
ALTER TABLE "ships" ALTER COLUMN "planet_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "ships" ADD COLUMN "star_id" text;--> statement-breakpoint
ALTER TABLE "ships" ADD COLUMN "trip" jsonb;--> statement-breakpoint
ALTER TABLE "move_orders" ADD CONSTRAINT "move_orders_game_id_ship_id_ships_game_id_id_fk" FOREIGN KEY ("game_id","ship_id") REFERENCES "public"."ships"("game_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "move_orders" ADD CONSTRAINT "move_orders_game_id_turn_turns_game_id_turn_fk" FOREIGN KEY ("game_id","turn") REFERENCES "public"."turns"("game_id","turn") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "move_orders" ADD CONSTRAINT "move_orders_game_id_player_id_players_game_id_player_id_fk" FOREIGN KEY ("game_id","player_id") REFERENCES "public"."players"("game_id","player_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ships" ADD CONSTRAINT "ships_game_id_star_id_stars_game_id_id_fk" FOREIGN KEY ("game_id","star_id") REFERENCES "public"."stars"("game_id","id") ON DELETE cascade ON UPDATE no action;