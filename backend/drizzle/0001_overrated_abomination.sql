CREATE TABLE "game_player_resources" (
	"gameId" integer NOT NULL,
	"playerId" integer NOT NULL,
	"resourceType" varchar(255) NOT NULL,
	"amount" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "game_player_resources_gameId_playerId_resourceType_pk" PRIMARY KEY("gameId","playerId","resourceType")
);
--> statement-breakpoint
ALTER TABLE "game_player_resources" ADD CONSTRAINT "game_player_resources_gameId_playerId_game_players_fk" FOREIGN KEY ("gameId","playerId") REFERENCES "public"."game_players"("gameId","playerId") ON DELETE cascade ON UPDATE no action;