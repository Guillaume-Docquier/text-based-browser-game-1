import { indexBy } from "@guillaume-docquier/tools-ts"
import type { GameId } from "shared/domain/games/GameId.ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import type { Resources } from "shared/domain/resources/Resources.ts"
import type { SubmittedAction } from "shared/domain/turns/actions/Action.ts"
import type { ResolutionFleet } from "shared/turn-resolution/state/ResolutionFleet.ts"
import type { ResolutionPlanet } from "shared/turn-resolution/state/ResolutionPlanet.ts"
import type { TurnState } from "shared/turn-resolution/TurnState.ts"

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
  planets: ResolutionPlanet[]
  fleets: ResolutionFleet[]
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
