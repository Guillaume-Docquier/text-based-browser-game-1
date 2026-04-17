ALTER TABLE "games" ADD COLUMN "winnerPlayerId" integer;
--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_winnerPlayerId_players_id_fk" FOREIGN KEY ("winnerPlayerId") REFERENCES "public"."players"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE TABLE "game_player_actions" (
	"gameId" integer NOT NULL,
	"playerId" integer NOT NULL,
	"tick" integer NOT NULL,
	"actionType" varchar(255) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "game_player_actions_gameId_playerId_tick_pk" PRIMARY KEY("gameId","playerId","tick")
);
--> statement-breakpoint
ALTER TABLE "game_player_actions" ADD CONSTRAINT "game_player_actions_gameId_playerId_game_players_fk" FOREIGN KEY ("gameId","playerId") REFERENCES "public"."game_players"("gameId","playerId") ON DELETE cascade ON UPDATE no action;
