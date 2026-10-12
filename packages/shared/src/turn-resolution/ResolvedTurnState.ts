import type { PlayerId } from "#shared/domain/players/PlayerId.ts"
import type { PositiveInteger } from "#shared/domain/ruleset/action-definitions/PositiveInteger.ts"
import type { SubmittedAction } from "#shared/domain/turns/actions/Action.ts"
import type { EffectOutcome } from "#shared/domain/turns/actions/EffectOutcome.ts"
import type { ResolvedAction } from "#shared/domain/turns/actions/ResolvedAction.ts"
import type { FleetId } from "#shared/domain/world/fleets/FleetId.ts"
import type { PlanetId } from "#shared/domain/world/planets/PlanetId.ts"
import type { TurnState } from "#shared/turn-resolution/TurnState.ts"

/**
 * The transient outcomes of advancing a Fleet that departed on an earlier turn.
 */
export type ResolvedContinuation = Readonly<{
  originatingSubmission: SubmittedAction
  departureTurn: PositiveInteger
  actionOutcomes: readonly EffectOutcome[]
}>

/**
 * The state of the turn after resolution.
 */
export type ResolvedTurnState = Omit<TurnState, "submittedActions"> & {
  readonly resolvedActions: readonly ResolvedAction[]
  readonly resolvedContinuations: readonly ResolvedContinuation[]
  readonly removedFleetIds: readonly FleetId[]
  readonly planetOwnershipChanges: ReadonlyArray<Readonly<{ planetId: PlanetId; ownerPlayerId: PlayerId | null }>>
}
