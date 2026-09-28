import { indexBy } from "@guillaume-docquier/tools-ts"
import type { SubmittedAction } from "game-rules/action-submission/Action.ts"
import type { GameId } from "game-rules/models/GameId.ts"
import type { PlayerId } from "game-rules/models/PlayerId.ts"
import type { Resources } from "game-rules/ruleset/effect-definitions/Resources.ts"
import type { Fleet } from "game-rules/turn-resolution/Fleet.ts"
import type { Planet } from "game-rules/turn-resolution/Planet.ts"
import type { TurnState } from "game-rules/turn-resolution/TurnState.ts"

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
