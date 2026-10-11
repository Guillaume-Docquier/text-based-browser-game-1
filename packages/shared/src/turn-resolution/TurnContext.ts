import type { Rng } from "@guillaume-docquier/tools-ts"
import type { Ruleset } from "#shared/domain/ruleset/Ruleset.ts"
import type { FleetId } from "#shared/domain/world/fleets/FleetId.ts"
import type { EffectPool } from "#shared/turn-resolution/effects/EffectPool.ts"
import type { ResolvedContinuation } from "#shared/turn-resolution/ResolvedTurnState.ts"
import type { TurnState } from "#shared/turn-resolution/TurnState.ts"

export type TurnContext = Readonly<{
  /**
   * Rng when you need it.
   * Will be seeded and persisted so runs are fully deterministic.
   */
  rng: Rng
  /**
   * The turn state, to mutate.
   */
  turnState: TurnState
  /**
   * All the Effects that need resolving, to mutate.
   */
  effectPool: EffectPool
  /**
   * The rules for this turn.
   */
  ruleset: Ruleset
  /** Fleet ids that were already in transit before this turn's departures. */
  previousJourneyFleetIds: readonly FleetId[]
  /** Fleet ids created by movement effects during this turn. */
  newDepartureFleetIds: Set<FleetId>
  /** Fleet ids removed during this turn and explicitly carried to persistence. */
  removedFleetIds: Set<FleetId>
  /** Transient continuation outcomes; never stored as action history. */
  resolvedContinuations: ResolvedContinuation[]
}>
