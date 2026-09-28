import type { NonNegativeNumber } from "@guillaume-docquier/tools-ts/schemas"
import type { FleetId } from "#game-rules/models/FleetId.ts"
import type { FleetName } from "#game-rules/models/FleetName.ts"
import type { PlanetId } from "#game-rules/models/PlanetId.ts"
import type { PlayerId } from "#game-rules/models/PlayerId.ts"

export type Fleet = {
  readonly id: FleetId
  readonly ownerPlayerId: PlayerId
  readonly name: FleetName
  strength: number
  originPlanetId: PlanetId
  /**
   * Defined only when moving.
   * We'd use a discriminated union here, but since we mutate the fleet, it's a bit hard to do.
   */
  destinationPlanetId?: PlanetId | undefined
  /**
   * Defined only when moving.
   * We'd use a discriminated union here, but since we mutate the fleet, it's a bit hard to do.
   */
  distanceToEnd?: NonNegativeNumber | undefined
  /**
   * Defined only when moving.
   * The internal turn tick at which the fleet arrived, for tie-breakers.
   * Tick 0 means the fleet was already on the destination planet at the start of the turn.
   */
  arrivedAtTick?: NonNegativeNumber | undefined
}
