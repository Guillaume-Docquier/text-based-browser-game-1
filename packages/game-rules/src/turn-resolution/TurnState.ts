import { branded } from "@guillaume-docquier/tools-ts"
import type { ReadonlyDeep } from "type-fest"
import type { SubmittedAction } from "#game-rules/action-submission/Action.ts"
import type { FleetId } from "#game-rules/models/FleetId.ts"
import type { GameId } from "#game-rules/models/GameId.ts"
import type { PlanetId } from "#game-rules/models/PlanetId.ts"
import type { PlayerId } from "#game-rules/models/PlayerId.ts"
import { TargetType } from "#game-rules/ruleset/effect-definitions/TargetType.ts"
import type { Fleet } from "#game-rules/turn-resolution/Fleet.ts"
import type { Planet } from "#game-rules/turn-resolution/Planet.ts"
import type { Player } from "#game-rules/turn-resolution/Player.ts"
import type { TargetableEntity } from "#game-rules/turn-resolution/TargetableEntity.ts"

/**
 * The current state of the turn.
 * This is generally mutated.
 */
export type TurnState = {
  /**
   * The game being resolved.
   */
  readonly gameId: GameId
  /**
   * The turn being resolved.
   */
  readonly turn: number
  readonly submittedActions: readonly SubmittedAction[]
  /**
   * Players for this turn, indexed by their id.
   * Players don't change, they are entirely readonly.
   */
  readonly players: Readonly<Record<PlayerId, Player>>
  /**
   * Planets for this turn, indexed by their id.
   * Planets don't change, they are entirely readonly.
   */
  readonly planets: Readonly<Record<PlanetId, Planet>>
  /**
   * Fleets for this turn, indexed by their id.
   * Fleets can be added as they are built.
   * Their strength can change as fleets are merged.
   */
  readonly fleets: Record<FleetId, Fleet>
  /**
   * If set, the game ends.
   */
  winnerPlayerId: PlayerId | undefined
}

export const TurnState = {
  /**
   * Finds a player in the turn state by id.
   */
  getPlayer(turnState: ReadonlyDeep<TurnState>, playerId: PlayerId): Player | undefined {
    return turnState.players[playerId]
  },

  /**
   * Finds a fleet in the turn state by id.
   */
  getFleet(turnState: ReadonlyDeep<TurnState>, fleetId: FleetId): Fleet | undefined {
    return turnState.fleets[fleetId]
  },

  /**
   * Finds a planet in the turn state by id.
   */
  getPlanet(turnState: ReadonlyDeep<TurnState>, planetId: PlanetId): Planet | undefined {
    return turnState.planets[planetId]
  },

  /**
   * Finds a target in the turn state and returns its full entity with a target type tag.
   */
  getTarget(
    turnState: ReadonlyDeep<TurnState>,
    { targetType, targetId }: { targetType: TargetType; targetId: string },
  ): TargetableEntity | undefined {
    switch (targetType) {
      case TargetType.PLAYER: {
        const player = TurnState.getPlayer(turnState, branded<PlayerId>(targetId))
        return player === undefined ? undefined : { type: TargetType.PLAYER, ...player }
      }
      case TargetType.FLEET: {
        const fleet = TurnState.getFleet(turnState, branded<FleetId>(targetId))
        return fleet === undefined ? undefined : { type: TargetType.FLEET, ...fleet }
      }
      case TargetType.PLANET: {
        const planet = TurnState.getPlanet(turnState, branded<PlanetId>(targetId))
        return planet === undefined ? undefined : { type: TargetType.PLANET, ...planet }
      }
    }
  },
}
