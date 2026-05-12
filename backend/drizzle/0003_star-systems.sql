CREATE TYPE "public"."body_type" AS ENUM('PLANET', 'MOON', 'ASTEROID');--> statement-breakpoint
CREATE TABLE "bodies" (
	"id" uuid PRIMARY KEY NOT NULL,
	"game_id" integer NOT NULL,
	"sector_id" uuid NOT NULL,
	"body_number" integer NOT NULL,
	"body_type" "body_type" NOT NULL,
	"name" varchar(255) NOT NULL,
	"movement_node_id" uuid NOT NULL,
	CONSTRAINT "bodies_game_id_id_unique" UNIQUE("game_id","id"),
	CONSTRAINT "bodies_sector_id_body_number_unique" UNIQUE("sector_id","body_number"),
	CONSTRAINT "bodies_movement_node_id_unique" UNIQUE("movement_node_id")
);
--> statement-breakpoint
CREATE TABLE "movement_edges" (
	"game_id" integer NOT NULL,
	"from_node_id" uuid NOT NULL,
	"to_node_id" uuid NOT NULL,
	"weight" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "movement_edges_game_id_from_node_id_to_node_id_pk" PRIMARY KEY("game_id","from_node_id","to_node_id")
);
--> statement-breakpoint
CREATE TABLE "movement_nodes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"game_id" integer NOT NULL,
	CONSTRAINT "movement_nodes_game_id_id_unique" UNIQUE("game_id","id")
);
--> statement-breakpoint
CREATE TABLE "orbits" (
	"id" uuid PRIMARY KEY NOT NULL,
	"game_id" integer NOT NULL,
	"orbit_number" integer NOT NULL,
	CONSTRAINT "orbits_game_id_id_unique" UNIQUE("game_id","id"),
	CONSTRAINT "orbits_game_id_orbit_number_unique" UNIQUE("game_id","orbit_number")
);
--> statement-breakpoint
CREATE TABLE "sectors" (
	"id" uuid PRIMARY KEY NOT NULL,
	"game_id" integer NOT NULL,
	"orbit_id" uuid NOT NULL,
	"sector_number" integer NOT NULL,
	"movement_node_id" uuid NOT NULL,
	CONSTRAINT "sectors_game_id_id_unique" UNIQUE("game_id","id"),
	CONSTRAINT "sectors_orbit_id_sector_number_unique" UNIQUE("orbit_id","sector_number"),
	CONSTRAINT "sectors_movement_node_id_unique" UNIQUE("movement_node_id")
);
--> statement-breakpoint
CREATE TABLE "star_systems" (
	"game_id" integer PRIMARY KEY NOT NULL,
	"generation_settings" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bodies" ADD CONSTRAINT "bodies_game_id_star_systems_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."star_systems"("game_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bodies" ADD CONSTRAINT "bodies_game_id_sector_id_sectors_fk" FOREIGN KEY ("game_id","sector_id") REFERENCES "public"."sectors"("game_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bodies" ADD CONSTRAINT "bodies_game_id_movement_node_id_movement_nodes_fk" FOREIGN KEY ("game_id","movement_node_id") REFERENCES "public"."movement_nodes"("game_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movement_edges" ADD CONSTRAINT "movement_edges_game_id_star_systems_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."star_systems"("game_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movement_edges" ADD CONSTRAINT "movement_edges_game_id_from_node_id_movement_nodes_fk" FOREIGN KEY ("game_id","from_node_id") REFERENCES "public"."movement_nodes"("game_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movement_edges" ADD CONSTRAINT "movement_edges_game_id_to_node_id_movement_nodes_fk" FOREIGN KEY ("game_id","to_node_id") REFERENCES "public"."movement_nodes"("game_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movement_nodes" ADD CONSTRAINT "movement_nodes_game_id_star_systems_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."star_systems"("game_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orbits" ADD CONSTRAINT "orbits_game_id_star_systems_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."star_systems"("game_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sectors" ADD CONSTRAINT "sectors_game_id_star_systems_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."star_systems"("game_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sectors" ADD CONSTRAINT "sectors_game_id_orbit_id_orbits_fk" FOREIGN KEY ("game_id","orbit_id") REFERENCES "public"."orbits"("game_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sectors" ADD CONSTRAINT "sectors_game_id_movement_node_id_movement_nodes_fk" FOREIGN KEY ("game_id","movement_node_id") REFERENCES "public"."movement_nodes"("game_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "star_systems" ADD CONSTRAINT "star_systems_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bodies_game_id_sector_id_idx" ON "bodies" USING btree ("game_id","sector_id");--> statement-breakpoint
CREATE INDEX "movement_edges_game_id_from_node_id_idx" ON "movement_edges" USING btree ("game_id","from_node_id");--> statement-breakpoint
CREATE INDEX "movement_nodes_game_id_idx" ON "movement_nodes" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "orbits_game_id_idx" ON "orbits" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "sectors_game_id_orbit_id_idx" ON "sectors" USING btree ("game_id","orbit_id");