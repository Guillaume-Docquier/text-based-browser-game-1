import type { PhaseContext } from "#turn-processing/engine/phases/PhaseContext.ts"

/**
 * A Phase takes a TurnState and an EffectPool, applies the Effects it knows how to handle, removing them from the Pool and mutating the TurnState.
 * For now a Phase doesn't return anything, but it could return some game logs of what happened and why.
 */
export type PhaseResolver = (context: PhaseContext) => void
