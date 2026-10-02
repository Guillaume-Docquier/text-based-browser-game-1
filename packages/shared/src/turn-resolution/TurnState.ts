import { branded } from "@guillaume-docquier/tools-ts"
import type { SubmittedAction } from "#shared/domain/actions/Action.ts"
import type { GameId } from "#shared/domain/game/GameId.ts"
import type { PlayerId } from "#shared/domain/players/PlayerId.ts"
import { TargetType } from "#shared/domain/ruleset/target-definitions/TargetType.ts"
import type { FleetId } from "#shared/domain/world/fleets/FleetId.ts"
import type { PlanetId } from "#shared/domain/world/planets/PlanetId.ts"
import type { ResolutionFleet } from "#shared/turn-resolution/state/ResolutionFleet.ts"
import type { ResolutionPlanet } from "#shared/turn-resolution/state/ResolutionPlanet.ts"
import type { ResolutionPlayer } from "#shared/turn-resolution/state/ResolutionPlayer.ts"
import type { TargetableEntity } from "#shared/turn-resolution/TargetableEntity.ts"

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
  readonly players: Readonly<Record<PlayerId, ResolutionPlayer>>
  /**
   * Planets for this turn, indexed by their id.
   * Planets don't change, they are entirely readonly.
   */
  readonly planets: Readonly<Record<PlanetId, ResolutionPlanet>>
  /**
   * Fleets for this turn, indexed by their id.
   * Fleets can be added as they are built.
   * Their strength can change as fleets are merged.
   */
  readonly fleets: Record<FleetId, ResolutionFleet>
  /**
   * If set, the game ends.
   */
  winnerPlayerId: PlayerId | undefined
}

export const TurnState = {
  /**
   * Finds a player in the turn state by id.
   */
  getPlayer(turnState: TurnState, playerId: PlayerId): ResolutionPlayer | undefined {
    return turnState.players[playerId]
  },

  /**
   * Finds a fleet in the turn state by id.
   */
  getFleet(turnState: TurnState, fleetId: FleetId): ResolutionFleet | undefined {
    return turnState.fleets[fleetId]
  },

  /**
   * Finds a planet in the turn state by id.
   */
  getPlanet(turnState: TurnState, planetId: PlanetId): ResolutionPlanet | undefined {
    return turnState.planets[planetId]
  },

  /**
   * Finds a target in the turn state and returns its full entity with a target type tag.
   */
  getTarget(turnState: TurnState, { targetType, targetId }: { targetType: TargetType; targetId: string }): TargetableEntity | undefined {
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
