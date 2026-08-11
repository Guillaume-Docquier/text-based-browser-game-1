import type { Effect } from "#turn-processing/engine/effects/Effect.ts"

/**
 * The EffectsPool contains all the Effects that need to be applied to the TurnState
 */
export type EffectsPool = Effect[]
