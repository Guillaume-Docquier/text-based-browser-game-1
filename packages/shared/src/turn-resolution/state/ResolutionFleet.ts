import type { NonNegativeNumber } from "@guillaume-docquier/tools-ts/schemas"
import type { Fleet } from "#shared/domain/world/fleets/Fleet.ts"

/**
 * The mutable turn-resolution view of a fleet's identity, ownership, and movement.
 */
export type ResolutionFleet = Fleet & {
  /**
   * Defined only when moving.
   * We'd use a discriminated union here, but since we mutate the fleet, it's a bit hard to do.
   *
   * The internal turn tick at which the fleet arrived, for tie-breakers.
   * Tick 0 means the fleet was already on the destination planet at the start of the turn.
   */
  arrivedAtTick?: NonNegativeNumber | undefined
}
