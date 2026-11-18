CREATE TYPE "public"."game_status" AS ENUM('WAITING_FOR_PLAYERS', 'READY_TO_START', 'IN_PROGRESS', 'ENDED');--> statement-breakpoint
CREATE TYPE "public"."planet_biome" AS ENUM('OCEANIC', 'METALLIC', 'FROZEN', 'VOLCANIC');--> statement-breakpoint
CREATE TYPE "public"."planet_size" AS ENUM('SMALL', 'MEDIUM', 'LARGE');--> statement-breakpoint
CREATE TYPE "public"."player_color" AS ENUM('TURQUOISE', 'RED', 'BLUE', 'TEAL', 'PURPLE', 'YELLOW', 'ORANGE', 'GREEN', 'LIGHT_PINK', 'VIOLET', 'LIGHT_GREY', 'DARK_GREEN', 'BROWN', 'LIGHT_GREEN', 'DARK_GREY', 'PINK');--> statement-breakpoint
CREATE TYPE "public"."turn_status" AS ENUM('COLLECTING_ACTIONS', 'AWAITING_PROCESSING', 'PROCESSING', 'COMPLETED');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_id" text NOT NULL,
	"email" text,
	"alias" text NOT NULL,
	"onboarded" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "games_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_by_account_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"ended_at" timestamp,
	"status" "game_status" DEFAULT 'WAITING_FOR_PLAYERS' NOT NULL,
	"name" text NOT NULL,
	"nb_seats" integer NOT NULL,
	"turn_interval_seconds" integer NOT NULL,
	"map_generation_seed" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "planets" (
	"game_id" integer NOT NULL,
	"star_id" text NOT NULL,
	"id" text NOT NULL,
	"owner_player_id" uuid,
	"name" varchar(36) NOT NULL,
	"coordinates" text NOT NULL,
	"x" double precision NOT NULL,
	"y" double precision NOT NULL,
	"biome" "planet_biome" NOT NULL,
	"size" "planet_size" NOT NULL,
	"fertility" integer NOT NULL,
	"metal" integer NOT NULL,
	"fuel" integer NOT NULL,
	"energy" integer NOT NULL,
	"max_population" integer NOT NULL,
	"area" integer NOT NULL,
	CONSTRAINT "planets_game_id_id_pk" PRIMARY KEY("game_id","id")
);
--> statement-breakpoint
CREATE TABLE "players" (
	"game_id" integer NOT NULL,
	"player_id" uuid NOT NULL,
	"color" "player_color" NOT NULL,
	"is_ready" boolean DEFAULT false NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "players_game_id_player_id_pk" PRIMARY KEY("game_id","player_id"),
	CONSTRAINT "players_game_id_color_unique" UNIQUE("game_id","color")
);
--> statement-breakpoint
CREATE TABLE "stars" (
	"game_id" integer NOT NULL,
	"id" text NOT NULL,
	"name" text NOT NULL,
	"coordinates" text NOT NULL,
	"x" double precision NOT NULL,
	"y" double precision NOT NULL,
	CONSTRAINT "stars_game_id_id_pk" PRIMARY KEY("game_id","id")
);
--> statement-breakpoint
CREATE TABLE "turns_processing" (
	"game_id" integer NOT NULL,
	"turn" integer NOT NULL,
	"scheduled_for" timestamp NOT NULL,
	"processing_started_at" timestamp,
	"processing_ended_at" timestamp,
	CONSTRAINT "turns_processing_game_id_turn_pk" PRIMARY KEY("game_id","turn")
);
--> statement-breakpoint
CREATE TABLE "turns" (
	"game_id" integer NOT NULL,
	"turn" integer NOT NULL,
	"status" "turn_status" NOT NULL,
	"started_at" timestamp NOT NULL,
	"ends_at" timestamp NOT NULL,
	"closed_at" timestamp,
	"rng_generator_state" bigint NOT NULL,
	"rng_spare_normal" double precision,
	CONSTRAINT "turns_game_id_turn_pk" PRIMARY KEY("game_id","turn")
);
--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_created_by_account_id_accounts_id_fk" FOREIGN KEY ("created_by_account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planets" ADD CONSTRAINT "planets_gameId_starId_planets_fk" FOREIGN KEY ("game_id","star_id") REFERENCES "public"."stars"("game_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planets" ADD CONSTRAINT "planets_gameId_ownerPlayerId_game_players_fk" FOREIGN KEY ("game_id","owner_player_id") REFERENCES "public"."players"("game_id","player_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_player_id_accounts_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stars" ADD CONSTRAINT "stars_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turns_processing" ADD CONSTRAINT "turns_processing_game_id_turn_turns_fk" FOREIGN KEY ("game_id","turn") REFERENCES "public"."turns"("game_id","turn") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turns" ADD CONSTRAINT "turns_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "auth_id_idx" ON "accounts" USING btree ("auth_id");--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_alias_unique" ON "accounts" USING btree (lower("alias"));--> statement-breakpoint
CREATE INDEX "turns_processing_scheduled_for_idx" ON "turns_processing" USING btree ("scheduled_for");--> statement-breakpoint
CREATE UNIQUE INDEX "turns_one_open_turn_per_game_unique" ON "turns" USING btree ("game_id") WHERE "turns"."status" <> 'COMPLETED';--> statement-breakpoint
CREATE INDEX "turns_status_ends_at_idx" ON "turns" USING btree ("status","ends_at");