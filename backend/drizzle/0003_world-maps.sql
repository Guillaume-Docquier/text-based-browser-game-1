CREATE TYPE "public"."game_map_body_type" AS ENUM('PLANET', 'MOON', 'ASTEROID');--> statement-breakpoint
CREATE TABLE "game_map_bodies" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "game_map_bodies_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"game_id" integer NOT NULL,
	"sector_id" integer NOT NULL,
	"body_number" integer NOT NULL,
	"body_type" "game_map_body_type" NOT NULL,
	"name" varchar(255) NOT NULL,
	"movement_node_id" integer NOT NULL,
	CONSTRAINT "game_map_bodies_game_id_id_unique" UNIQUE("game_id","id"),
	CONSTRAINT "game_map_bodies_sector_id_body_number_unique" UNIQUE("sector_id","body_number"),
	CONSTRAINT "game_map_bodies_movement_node_id_unique" UNIQUE("movement_node_id")
);
--> statement-breakpoint
CREATE TABLE "game_map_movement_edges" (
	"game_id" integer NOT NULL,
	"from_node_id" integer NOT NULL,
	"to_node_id" integer NOT NULL,
	"weight" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "game_map_movement_edges_game_id_from_node_id_to_node_id_pk" PRIMARY KEY("game_id","from_node_id","to_node_id")
);
--> statement-breakpoint
CREATE TABLE "game_map_movement_nodes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "game_map_movement_nodes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"game_id" integer NOT NULL,
	CONSTRAINT "game_map_movement_nodes_game_id_id_unique" UNIQUE("game_id","id")
);
--> statement-breakpoint
CREATE TABLE "game_map_orbits" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "game_map_orbits_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"game_id" integer NOT NULL,
	"orbit_number" integer NOT NULL,
	CONSTRAINT "game_map_orbits_game_id_id_unique" UNIQUE("game_id","id"),
	CONSTRAINT "game_map_orbits_game_id_orbit_number_unique" UNIQUE("game_id","orbit_number")
);
--> statement-breakpoint
CREATE TABLE "game_map_sectors" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "game_map_sectors_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"game_id" integer NOT NULL,
	"orbit_id" integer NOT NULL,
	"sector_number" integer NOT NULL,
	"movement_node_id" integer NOT NULL,
	CONSTRAINT "game_map_sectors_game_id_id_unique" UNIQUE("game_id","id"),
	CONSTRAINT "game_map_sectors_orbit_id_sector_number_unique" UNIQUE("orbit_id","sector_number"),
	CONSTRAINT "game_map_sectors_movement_node_id_unique" UNIQUE("movement_node_id")
);
--> statement-breakpoint
CREATE TABLE "game_maps" (
	"game_id" integer PRIMARY KEY NOT NULL,
	"generation_settings" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "game_map_bodies" ADD CONSTRAINT "game_map_bodies_game_id_game_maps_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game_maps"("game_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_map_bodies" ADD CONSTRAINT "game_map_bodies_game_id_sector_id_game_map_sectors_fk" FOREIGN KEY ("game_id","sector_id") REFERENCES "public"."game_map_sectors"("game_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_map_bodies" ADD CONSTRAINT "game_map_bodies_game_id_movement_node_id_game_map_movement_nodes_fk" FOREIGN KEY ("game_id","movement_node_id") REFERENCES "public"."game_map_movement_nodes"("game_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_map_movement_edges" ADD CONSTRAINT "game_map_movement_edges_game_id_game_maps_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game_maps"("game_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_map_movement_edges" ADD CONSTRAINT "game_map_movement_edges_game_id_from_node_id_game_map_movement_nodes_fk" FOREIGN KEY ("game_id","from_node_id") REFERENCES "public"."game_map_movement_nodes"("game_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_map_movement_edges" ADD CONSTRAINT "game_map_movement_edges_game_id_to_node_id_game_map_movement_nodes_fk" FOREIGN KEY ("game_id","to_node_id") REFERENCES "public"."game_map_movement_nodes"("game_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_map_movement_nodes" ADD CONSTRAINT "game_map_movement_nodes_game_id_game_maps_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game_maps"("game_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_map_orbits" ADD CONSTRAINT "game_map_orbits_game_id_game_maps_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game_maps"("game_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_map_sectors" ADD CONSTRAINT "game_map_sectors_game_id_game_maps_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game_maps"("game_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_map_sectors" ADD CONSTRAINT "game_map_sectors_game_id_orbit_id_game_map_orbits_fk" FOREIGN KEY ("game_id","orbit_id") REFERENCES "public"."game_map_orbits"("game_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_map_sectors" ADD CONSTRAINT "game_map_sectors_game_id_movement_node_id_game_map_movement_nodes_fk" FOREIGN KEY ("game_id","movement_node_id") REFERENCES "public"."game_map_movement_nodes"("game_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_maps" ADD CONSTRAINT "game_maps_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "game_map_bodies_game_id_sector_id_idx" ON "game_map_bodies" USING btree ("game_id","sector_id");--> statement-breakpoint
CREATE INDEX "game_map_movement_edges_game_id_from_node_id_idx" ON "game_map_movement_edges" USING btree ("game_id","from_node_id");--> statement-breakpoint
CREATE INDEX "game_map_movement_nodes_game_id_idx" ON "game_map_movement_nodes" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "game_map_orbits_game_id_idx" ON "game_map_orbits" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "game_map_sectors_game_id_orbit_id_idx" ON "game_map_sectors" USING btree ("game_id","orbit_id");