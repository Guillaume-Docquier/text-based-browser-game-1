import { type Branded, branded } from "@guillaume-docquier/tools-ts"
import type { GameId } from "#lib/db/games/GameId.ts"
import type { PlayerId } from "#lib/db/players/PlayerId.ts"

/** A player and game pair whose membership relationship has been established. */
export type PlayerInGame = Branded<{ readonly gameId: GameId; readonly playerId: PlayerId }, "PlayerInGame">

/** Marks a player as belonging to the current game after its membership has been checked. */
export function playerInGame(gameId: GameId, playerId: PlayerId): PlayerInGame {
  return branded<PlayerInGame>({ gameId, playerId })
}
