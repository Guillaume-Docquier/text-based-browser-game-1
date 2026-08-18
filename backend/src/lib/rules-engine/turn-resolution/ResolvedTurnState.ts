import type { ResolvedAction } from "#lib/rules-engine/turn-resolution/ResolvedAction.ts"
import type { TurnState } from "#lib/rules-engine/turn-resolution/TurnState.ts"

/**
 * The state of the turn after resolution.
 */
export type ResolvedTurnState = Omit<TurnState, "actionSubmissions"> & {
  readonly resolvedActions: readonly ResolvedAction[]
}
