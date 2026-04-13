CREATE TABLE "game_players" (
	"gameId" integer NOT NULL,
	"playerId" integer NOT NULL,
	"joinedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "game_players_gameId_playerId_pk" PRIMARY KEY("gameId","playerId")
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
	"name" varchar(255) NOT NULL,
	"createdByPlayerId" integer NOT NULL,
	"nbSeats" integer NOT NULL,
	"tickIntervalSeconds" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"startedAt" timestamp,
	"endedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "players_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"clerk_id" varchar(255) NOT NULL,
	"email" varchar(255),
	"alias" varchar(255)
);
--> statement-breakpoint
ALTER TABLE "game_players" ADD CONSTRAINT "game_players_gameId_games_id_fk" FOREIGN KEY ("gameId") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_players" ADD CONSTRAINT "game_players_playerId_players_id_fk" FOREIGN KEY ("playerId") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_states" ADD CONSTRAINT "game_states_gameId_games_id_fk" FOREIGN KEY ("gameId") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_ticks" ADD CONSTRAINT "game_ticks_gameId_games_id_fk" FOREIGN KEY ("gameId") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_createdByPlayerId_players_id_fk" FOREIGN KEY ("createdByPlayerId") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "game_ticks_scheduledFor_index" ON "game_ticks" USING btree ("scheduledFor");--> statement-breakpoint
CREATE UNIQUE INDEX "clerk_id_idx" ON "players" USING btree ("clerk_id");