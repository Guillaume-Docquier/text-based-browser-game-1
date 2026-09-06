import type { FleetId } from "#lib/db/fleets/FleetId.ts"
import type { PlanetId } from "#lib/db/planets/PlanetId.ts"
import type { PlayerId } from "#lib/db/players/PlayerId.ts"
import type { SubmittedAction } from "#lib/rules-engine/action-submission/Action.ts"
import type { Resources } from "#lib/rules-engine/ruleset-model/mechanics/Resources.ts"

/**
 * The current state of the turn.
 * This is generally mutated.
 */
export type TurnState = {
  readonly submittedActions: readonly SubmittedAction[]
  readonly players: Readonly<
    Record<
      string, // can't use PlayerId here because of an interaction with DeepReadonly from utility-types that doesn't work with brands
      {
        id: PlayerId
        resources: Resources
      }
    >
  >
  readonly planets: Readonly<Record<string, { id: PlanetId }>>
  readonly fleets: Record<string, FleetState>
  /**
   * If set, the game ends.
   */
  winnerPlayerId: PlayerId | undefined
}

export type FleetState = {
  id: FleetId
  playerId: PlayerId
  strength: number
  originPlanetId: PlanetId
}
