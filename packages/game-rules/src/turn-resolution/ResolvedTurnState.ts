import type { ResolvedAction } from "#game-rules/turn-resolution/ResolvedAction.ts"
import type { TurnState } from "#game-rules/turn-resolution/TurnState.ts"

/**
 * The state of the turn after resolution.
 */
export type ResolvedTurnState = Omit<TurnState, "submittedActions"> & {
  readonly resolvedActions: readonly ResolvedAction[]
}
