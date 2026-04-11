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
ALTER TABLE "game_states" ADD CONSTRAINT "game_states_gameId_games_id_fk" FOREIGN KEY ("gameId") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_ticks" ADD CONSTRAINT "game_ticks_gameId_games_id_fk" FOREIGN KEY ("gameId") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "game_ticks_scheduledFor_index" ON "game_ticks" USING btree ("scheduledFor");