import { indexBy } from "@guillaume-docquier/tools-ts"
import type { GameId } from "#lib/db/games/GameId.ts"
import type { PlayerId } from "#lib/db/players/PlayerId.ts"
import type { SubmittedAction } from "#lib/rules-engine/action-submission/Action.ts"
import type { Resources } from "#lib/rules-engine/ruleset/mechanics/Resources.ts"
import type { Fleet, Planet, TurnState } from "#lib/rules-engine/turn-resolution/TurnState.ts"

export function createTurnState({
  gameId,
  turn,
  playerId,
  resources,
  submittedActions,
  planets,
  fleets,
}: {
  gameId: GameId
  turn: number
  playerId: PlayerId
  resources: Resources
  submittedActions: readonly SubmittedAction[]
  planets: Planet[]
  fleets: Fleet[]
}): TurnState {
  return {
    gameId,
    turn,
    submittedActions,
    players: indexBy("id", [{ id: playerId, resources }]),
    planets: indexBy("id", planets),
    fleets: indexBy("id", fleets),
    winnerPlayerId: undefined,
  }
}
