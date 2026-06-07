ALTER TABLE "star_systems" RENAME TO "maps";--> statement-breakpoint
ALTER TABLE "game_settings" RENAME COLUMN "star_system_generation_settings" TO "map_generation_settings";--> statement-breakpoint
ALTER TABLE "maps" RENAME CONSTRAINT "star_systems_game_id_games_id_fk" TO "maps_game_id_games_id_fk";--> statement-breakpoint
ALTER TABLE "orbits" RENAME CONSTRAINT "orbits_game_id_star_systems_game_id_fk" TO "orbits_game_id_maps_game_id_fk";--> statement-breakpoint
ALTER TABLE "sectors" RENAME CONSTRAINT "sectors_game_id_star_systems_game_id_fk" TO "sectors_game_id_maps_game_id_fk";--> statement-breakpoint
ALTER TABLE "bodies" RENAME CONSTRAINT "bodies_game_id_star_systems_game_id_fk" TO "bodies_game_id_maps_game_id_fk";--> statement-breakpoint
ALTER TABLE "movement_nodes" RENAME CONSTRAINT "movement_nodes_game_id_star_systems_game_id_fk" TO "movement_nodes_game_id_maps_game_id_fk";--> statement-breakpoint
ALTER TABLE "movement_edges" RENAME CONSTRAINT "movement_edges_game_id_star_systems_game_id_fk" TO "movement_edges_game_id_maps_game_id_fk";
