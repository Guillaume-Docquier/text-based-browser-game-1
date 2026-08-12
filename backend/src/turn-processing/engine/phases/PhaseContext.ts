import type { EffectPool } from "#turn-processing/engine/EffectPool.ts"
import type { TurnState } from "#turn-processing/engine/TurnState.ts"
import type { Ruleset } from "#turn-processing/ruleset/ruleset.ts"

export type PhaseContext = {
  /**
   * The turn state, to mutate.
   */
  state: TurnState
  /**
   * All the Effects that need resolving, to mutate.
   */
  effects: EffectPool
  ruleset: Ruleset
}
