import type { FleetId } from "#lib/db/fleets/FleetId.ts"
import type { GameId } from "#lib/db/games/GameId.ts"
import type { PlanetId } from "#lib/db/planets/PlanetId.ts"
import type { PlayerId } from "#lib/db/players/PlayerId.ts"
import type { SubmittedAction } from "#lib/rules-engine/action-submission/Action.ts"
import type { Resources } from "#lib/rules-engine/ruleset-model/mechanics/Resources.ts"

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

export type Player = {
  readonly id: PlayerId
  readonly resources: Resources
}

export type Planet = {
  readonly id: PlanetId
  readonly ownerPlayerId: PlayerId | null
  readonly x: number
  readonly y: number
}

export type Fleet = {
  readonly id: FleetId
  readonly playerId: PlayerId
  strength: number
  readonly originPlanetId: PlanetId
}
