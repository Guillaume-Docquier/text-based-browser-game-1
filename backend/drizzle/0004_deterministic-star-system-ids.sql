ALTER TABLE "bodies" DROP CONSTRAINT "bodies_game_id_sector_id_sectors_fk";--> statement-breakpoint
ALTER TABLE "bodies" DROP CONSTRAINT "bodies_game_id_movement_node_id_movement_nodes_fk";--> statement-breakpoint
ALTER TABLE "movement_edges" DROP CONSTRAINT "movement_edges_game_id_from_node_id_movement_nodes_fk";--> statement-breakpoint
ALTER TABLE "movement_edges" DROP CONSTRAINT "movement_edges_game_id_to_node_id_movement_nodes_fk";--> statement-breakpoint
ALTER TABLE "sectors" DROP CONSTRAINT "sectors_game_id_orbit_id_orbits_fk";--> statement-breakpoint
ALTER TABLE "sectors" DROP CONSTRAINT "sectors_game_id_movement_node_id_movement_nodes_fk";--> statement-breakpoint

ALTER TABLE "bodies" DROP CONSTRAINT "bodies_pkey";--> statement-breakpoint
ALTER TABLE "bodies" DROP CONSTRAINT "bodies_game_id_id_unique";--> statement-breakpoint
ALTER TABLE "bodies" DROP CONSTRAINT "bodies_sector_id_body_number_unique";--> statement-breakpoint
ALTER TABLE "bodies" DROP CONSTRAINT "bodies_movement_node_id_unique";--> statement-breakpoint
ALTER TABLE "movement_nodes" DROP CONSTRAINT "movement_nodes_pkey";--> statement-breakpoint
ALTER TABLE "movement_nodes" DROP CONSTRAINT "movement_nodes_game_id_id_unique";--> statement-breakpoint
ALTER TABLE "orbits" DROP CONSTRAINT "orbits_pkey";--> statement-breakpoint
ALTER TABLE "orbits" DROP CONSTRAINT "orbits_game_id_id_unique";--> statement-breakpoint
ALTER TABLE "sectors" DROP CONSTRAINT "sectors_pkey";--> statement-breakpoint
ALTER TABLE "sectors" DROP CONSTRAINT "sectors_game_id_id_unique";--> statement-breakpoint
ALTER TABLE "sectors" DROP CONSTRAINT "sectors_orbit_id_sector_number_unique";--> statement-breakpoint
ALTER TABLE "sectors" DROP CONSTRAINT "sectors_movement_node_id_unique";--> statement-breakpoint

ALTER TABLE "bodies" ADD CONSTRAINT "bodies_game_id_id_pk" PRIMARY KEY("game_id","id");--> statement-breakpoint
ALTER TABLE "movement_nodes" ADD CONSTRAINT "movement_nodes_game_id_id_pk" PRIMARY KEY("game_id","id");--> statement-breakpoint
ALTER TABLE "orbits" ADD CONSTRAINT "orbits_game_id_id_pk" PRIMARY KEY("game_id","id");--> statement-breakpoint
ALTER TABLE "sectors" ADD CONSTRAINT "sectors_game_id_id_pk" PRIMARY KEY("game_id","id");--> statement-breakpoint
ALTER TABLE "bodies" ADD CONSTRAINT "bodies_game_id_sector_id_body_number_unique" UNIQUE("game_id","sector_id","body_number");--> statement-breakpoint
ALTER TABLE "bodies" ADD CONSTRAINT "bodies_game_id_movement_node_id_unique" UNIQUE("game_id","movement_node_id");--> statement-breakpoint
ALTER TABLE "sectors" ADD CONSTRAINT "sectors_game_id_orbit_id_sector_number_unique" UNIQUE("game_id","orbit_id","sector_number");--> statement-breakpoint
ALTER TABLE "sectors" ADD CONSTRAINT "sectors_game_id_movement_node_id_unique" UNIQUE("game_id","movement_node_id");--> statement-breakpoint

ALTER TABLE "bodies" ADD CONSTRAINT "bodies_game_id_sector_id_sectors_fk" FOREIGN KEY ("game_id","sector_id") REFERENCES "public"."sectors"("game_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bodies" ADD CONSTRAINT "bodies_game_id_movement_node_id_movement_nodes_fk" FOREIGN KEY ("game_id","movement_node_id") REFERENCES "public"."movement_nodes"("game_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movement_edges" ADD CONSTRAINT "movement_edges_game_id_from_node_id_movement_nodes_fk" FOREIGN KEY ("game_id","from_node_id") REFERENCES "public"."movement_nodes"("game_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movement_edges" ADD CONSTRAINT "movement_edges_game_id_to_node_id_movement_nodes_fk" FOREIGN KEY ("game_id","to_node_id") REFERENCES "public"."movement_nodes"("game_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sectors" ADD CONSTRAINT "sectors_game_id_orbit_id_orbits_fk" FOREIGN KEY ("game_id","orbit_id") REFERENCES "public"."orbits"("game_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sectors" ADD CONSTRAINT "sectors_game_id_movement_node_id_movement_nodes_fk" FOREIGN KEY ("game_id","movement_node_id") REFERENCES "public"."movement_nodes"("game_id","id") ON DELETE no action ON UPDATE no action;
