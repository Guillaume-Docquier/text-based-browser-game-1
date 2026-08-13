import type { Effect } from "#lib/rules-engine/effects/Effect.ts"
import type { PhaseContext } from "#lib/rules-engine/phases/PhaseContext.ts"

/**
 * Resolves an effect by mutating the PhaseContext TurnState
 */
export type EffectResolver = (context: PhaseContext, effect: Effect) => void
