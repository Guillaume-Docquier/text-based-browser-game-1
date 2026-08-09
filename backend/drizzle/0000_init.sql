CREATE TYPE "public"."action_type" AS ENUM('MAKE_MORE_MONEY', 'WIN_THE_GAME');--> statement-breakpoint
CREATE TYPE "public"."game_status" AS ENUM('WAITING_FOR_PLAYERS', 'READY_TO_START', 'COLLECTING_ACTIONS', 'PROCESSING_TURN', 'ENDED');--> statement-breakpoint
CREATE TYPE "public"."player_color" AS ENUM('WHITE', 'RED', 'BLUE', 'TEAL', 'PURPLE', 'YELLOW', 'ORANGE', 'GREEN', 'LIGHT_PINK', 'VIOLET', 'LIGHT_GREY', 'DARK_GREEN', 'BROWN', 'LIGHT_GREEN', 'DARK_GREY', 'PINK');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_id" varchar(255) NOT NULL,
	"email" varchar(255),
	"alias" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "actions" (
	"game_id" integer NOT NULL,
	"player_id" uuid NOT NULL,
	"turn" integer NOT NULL,
	"action_type" "action_type" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "actions_game_id_player_id_turn_pk" PRIMARY KEY("game_id","player_id","turn")
);
--> statement-breakpoint
CREATE TABLE "game_states" (
	"game_id" integer PRIMARY KEY NOT NULL,
	"turn" integer DEFAULT 0 NOT NULL,
	"next_turn_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "games_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_by_account_id" uuid NOT NULL,
	"winner_account_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"ended_at" timestamp,
	"status" "game_status" DEFAULT 'WAITING_FOR_PLAYERS' NOT NULL,
	"name" varchar(255) NOT NULL,
	"nb_seats" integer NOT NULL,
	"turn_interval_seconds" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "players" (
	"game_id" integer NOT NULL,
	"player_id" uuid NOT NULL,
	"color" "player_color" NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "players_game_id_player_id_pk" PRIMARY KEY("game_id","player_id"),
	CONSTRAINT "players_game_id_color_unique" UNIQUE("game_id","color")
);
--> statement-breakpoint
CREATE TABLE "resources" (
	"game_id" integer NOT NULL,
	"player_id" uuid NOT NULL,
	"resource_type" varchar(255) NOT NULL,
	"amount" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "resources_game_id_player_id_resource_type_pk" PRIMARY KEY("game_id","player_id","resource_type")
);
--> statement-breakpoint
CREATE TABLE "turns" (
	"game_id" integer NOT NULL,
	"turn" integer NOT NULL,
	"scheduled_for" timestamp NOT NULL,
	"processing_started_at" timestamp,
	"processing_ended_at" timestamp,
	CONSTRAINT "turns_game_id_turn_pk" PRIMARY KEY("game_id","turn")
);
--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_gameId_playerId_game_players_fk" FOREIGN KEY ("game_id","player_id") REFERENCES "public"."players"("game_id","player_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_states" ADD CONSTRAINT "game_states_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_created_by_account_id_accounts_id_fk" FOREIGN KEY ("created_by_account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_winner_account_id_accounts_id_fk" FOREIGN KEY ("winner_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_player_id_accounts_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_gameId_playerId_game_players_fk" FOREIGN KEY ("game_id","player_id") REFERENCES "public"."players"("game_id","player_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turns" ADD CONSTRAINT "turns_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "auth_id_idx" ON "accounts" USING btree ("auth_id");--> statement-breakpoint
CREATE INDEX "turns_scheduled_for_index" ON "turns" USING btree ("scheduled_for");