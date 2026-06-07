CREATE TYPE "public"."body_type" AS ENUM('PLANET', 'MOON', 'ASTEROID');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "accounts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"auth_id" varchar(255) NOT NULL,
	"email" varchar(255),
	"alias" varchar(255)
);
--> statement-breakpoint
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
CREATE TABLE "game_player_actions" (
	"gameId" integer NOT NULL,
	"playerId" uuid NOT NULL,
	"tick" integer NOT NULL,
	"actionType" varchar(255) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "game_player_actions_gameId_playerId_tick_pk" PRIMARY KEY("gameId","playerId","tick")
);
--> statement-breakpoint
CREATE TABLE "game_player_resources" (
	"gameId" integer NOT NULL,
	"playerId" uuid NOT NULL,
	"resourceType" varchar(255) NOT NULL,
	"amount" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "game_player_resources_gameId_playerId_resourceType_pk" PRIMARY KEY("gameId","playerId","resourceType")
);
--> statement-breakpoint
CREATE TABLE "game_settings" (
	"game_id" integer PRIMARY KEY NOT NULL,
	"locked" boolean DEFAULT false NOT NULL,
	"name" varchar(255) NOT NULL,
	"star_system_generation_settings" jsonb NOT NULL,
	"nbSeats" integer NOT NULL,
	"tickIntervalSeconds" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_states" (
	"gameId" integer PRIMARY KEY NOT NULL,
	"tick" integer DEFAULT 0 NOT NULL,
	"nextTickAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_ticks" (
	"gameId" integer NOT NULL,
	"tick" integer NOT NULL,
	"scheduledFor" timestamp NOT NULL,
	"processingStartedAt" timestamp,
	"processingEndedAt" timestamp,
	CONSTRAINT "game_ticks_gameId_tick_pk" PRIMARY KEY("gameId","tick")
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "games_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"createdByAccountId" integer NOT NULL,
	"winnerPlayerId" uuid,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"startedAt" timestamp,
	"endedAt" timestamp,
	CONSTRAINT "games_id_created_by_account_id_unique" UNIQUE("id","createdByAccountId")
);
--> statement-breakpoint
CREATE TABLE "movement_edges" (
	"game_id" integer NOT NULL,
	"from_node_id" uuid NOT NULL,
	"to_node_id" uuid NOT NULL,
	"weight" integer NOT NULL,
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
CREATE TABLE "players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gameId" integer NOT NULL,
	"accountId" integer NOT NULL,
	"joinedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "players_game_id_id_unique" UNIQUE("gameId","id")
);
--> statement-breakpoint
CREATE TABLE "sectors" (
	"id" uuid PRIMARY KEY NOT NULL,
	"game_id" integer NOT NULL,
	"orbit_id" uuid NOT NULL,
	"sector_number" integer NOT NULL,
	"angle_numeric_type" varchar(16) NOT NULL,
	"angle_max_bound_type" varchar(16) NOT NULL,
	"start_angle_degrees" double precision NOT NULL,
	"end_angle_degrees" double precision NOT NULL,
	"movement_node_id" uuid NOT NULL,
	CONSTRAINT "sectors_game_id_id_unique" UNIQUE("game_id","id"),
	CONSTRAINT "sectors_orbit_id_sector_number_unique" UNIQUE("orbit_id","sector_number"),
	CONSTRAINT "sectors_movement_node_id_unique" UNIQUE("movement_node_id"),
	CONSTRAINT "sectors_angle_numeric_type_check" CHECK ("sectors"."angle_numeric_type" in ('float', 'integer')),
	CONSTRAINT "sectors_angle_max_bound_type_check" CHECK ("sectors"."angle_max_bound_type" in ('inclusive', 'exclusive')),
	CONSTRAINT "sectors_start_angle_degrees_check" CHECK ("sectors"."start_angle_degrees" >= 0),
	CONSTRAINT "sectors_end_angle_degrees_check" CHECK ("sectors"."end_angle_degrees" <= 360),
	CONSTRAINT "sectors_angle_degrees_order_check" CHECK ("sectors"."start_angle_degrees" < "sectors"."end_angle_degrees")
);
--> statement-breakpoint
CREATE TABLE "star_systems" (
	"game_id" integer PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bodies" ADD CONSTRAINT "bodies_game_id_star_systems_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."star_systems"("game_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bodies" ADD CONSTRAINT "bodies_game_id_sector_id_sectors_fk" FOREIGN KEY ("game_id","sector_id") REFERENCES "public"."sectors"("game_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bodies" ADD CONSTRAINT "bodies_game_id_movement_node_id_movement_nodes_fk" FOREIGN KEY ("game_id","movement_node_id") REFERENCES "public"."movement_nodes"("game_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_player_actions" ADD CONSTRAINT "game_player_actions_gameId_playerId_players_fk" FOREIGN KEY ("gameId","playerId") REFERENCES "public"."players"("gameId","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_player_resources" ADD CONSTRAINT "game_player_resources_gameId_playerId_players_fk" FOREIGN KEY ("gameId","playerId") REFERENCES "public"."players"("gameId","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_settings" ADD CONSTRAINT "game_settings_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_states" ADD CONSTRAINT "game_states_gameId_games_id_fk" FOREIGN KEY ("gameId") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_ticks" ADD CONSTRAINT "game_ticks_gameId_games_id_fk" FOREIGN KEY ("gameId") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_createdByAccountId_accounts_id_fk" FOREIGN KEY ("createdByAccountId") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_winnerPlayerId_players_id_fk" FOREIGN KEY ("winnerPlayerId") REFERENCES "public"."players"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movement_edges" ADD CONSTRAINT "movement_edges_game_id_star_systems_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."star_systems"("game_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movement_edges" ADD CONSTRAINT "movement_edges_game_id_from_node_id_movement_nodes_fk" FOREIGN KEY ("game_id","from_node_id") REFERENCES "public"."movement_nodes"("game_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movement_edges" ADD CONSTRAINT "movement_edges_game_id_to_node_id_movement_nodes_fk" FOREIGN KEY ("game_id","to_node_id") REFERENCES "public"."movement_nodes"("game_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movement_nodes" ADD CONSTRAINT "movement_nodes_game_id_star_systems_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."star_systems"("game_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orbits" ADD CONSTRAINT "orbits_game_id_star_systems_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."star_systems"("game_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_gameId_games_id_fk" FOREIGN KEY ("gameId") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_accountId_accounts_id_fk" FOREIGN KEY ("accountId") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sectors" ADD CONSTRAINT "sectors_game_id_star_systems_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."star_systems"("game_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sectors" ADD CONSTRAINT "sectors_game_id_orbit_id_orbits_fk" FOREIGN KEY ("game_id","orbit_id") REFERENCES "public"."orbits"("game_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sectors" ADD CONSTRAINT "sectors_game_id_movement_node_id_movement_nodes_fk" FOREIGN KEY ("game_id","movement_node_id") REFERENCES "public"."movement_nodes"("game_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "star_systems" ADD CONSTRAINT "star_systems_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_auth_id_idx" ON "accounts" USING btree ("auth_id");--> statement-breakpoint
CREATE INDEX "bodies_game_id_sector_id_idx" ON "bodies" USING btree ("game_id","sector_id");--> statement-breakpoint
CREATE INDEX "game_ticks_scheduledFor_index" ON "game_ticks" USING btree ("scheduledFor");--> statement-breakpoint
CREATE INDEX "movement_edges_game_id_from_node_id_idx" ON "movement_edges" USING btree ("game_id","from_node_id");--> statement-breakpoint
CREATE INDEX "movement_nodes_game_id_idx" ON "movement_nodes" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "orbits_game_id_idx" ON "orbits" USING btree ("game_id");--> statement-breakpoint
CREATE UNIQUE INDEX "players_game_id_account_id_idx" ON "players" USING btree ("gameId","accountId");--> statement-breakpoint
CREATE INDEX "sectors_game_id_orbit_id_idx" ON "sectors" USING btree ("game_id","orbit_id");