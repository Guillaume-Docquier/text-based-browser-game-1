import type { ResolvedAction } from "#shared/domain/turns/actions/ResolvedAction.ts"
import type { TurnState } from "#shared/turn-resolution/TurnState.ts"

/**
 * The state of the turn after resolution.
 */
export type ResolvedTurnState = Omit<TurnState, "submittedActions"> & {
  readonly resolvedActions: readonly ResolvedAction[]
}
