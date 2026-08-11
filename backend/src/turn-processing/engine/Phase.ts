import type { EffectsPool } from "#turn-processing/engine/EffectsPool.ts"
import type { TurnState } from "#turn-processing/engine/TurnState.ts"

/**
 * A Phase takes a TurnState and an EffectsPool, applies the Effects it knows how to handle, removing them from the Pool and mutating the TurnState.
 * For now a Phase doesn't return anything, but it could return some game logs of what happened and why.
 */
export type Phase = (turnState: TurnState, effectsPool: EffectsPool) => void
