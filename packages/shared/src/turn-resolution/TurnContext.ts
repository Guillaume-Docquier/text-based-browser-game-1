import type { Rng } from "@guillaume-docquier/tools-ts"
import type { NonNegativeSafeInteger } from "#shared/domain/NonNegativeSafeInteger.ts"
import type { PositiveInteger } from "#shared/domain/ruleset/action-definitions/PositiveInteger.ts"
import type { FleetAssaultEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetAssaultEffectDefinition.ts"
import type { Ruleset } from "#shared/domain/ruleset/Ruleset.ts"
import type { SubmittedAction } from "#shared/domain/turns/actions/Action.ts"
import type { EffectOutcome } from "#shared/domain/turns/actions/EffectOutcome.ts"
import type { FleetId } from "#shared/domain/world/fleets/FleetId.ts"
import type { PlanetId } from "#shared/domain/world/planets/PlanetId.ts"
import type { EffectPool } from "#shared/turn-resolution/effects/EffectPool.ts"
import type { ResolvedContinuation } from "#shared/turn-resolution/ResolvedTurnState.ts"
import type { TurnState } from "#shared/turn-resolution/TurnState.ts"

export type PendingArrivalAssaultIntent = {
  readonly effectDefinition: FleetAssaultEffectDefinition
  readonly definitionOrdinal: NonNegativeSafeInteger
  readonly submittedAction: SubmittedAction
  readonly departureTurn: PositiveInteger
  readonly initiatingJourneyId: FleetId
  actualFleetId: FleetId
  readonly planetId: PlanetId
  readonly tick: number
  readonly actionOutcomes: EffectOutcome[]
}

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
  /**
   * Captured arrival Assault intents, rebound to merged survivors before combat.
   */
  pendingArrivalAssaults: PendingArrivalAssaultIntent[]
  /**
   * Fleet ids retired by arrival merges and their surviving identities.
   */
  fleetIdRebindings: Map<FleetId, FleetId>
}>
