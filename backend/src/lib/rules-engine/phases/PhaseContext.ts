import type { EffectPool } from "#lib/rules-engine/effects/EffectPool.ts"
import type { TurnState } from "#lib/rules-engine/TurnState.ts"
import type { Ruleset } from "#lib/ruleset/ruleset.ts"

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
