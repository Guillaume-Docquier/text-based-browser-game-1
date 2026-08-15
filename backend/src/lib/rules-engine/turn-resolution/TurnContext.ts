import type { EffectPool } from "#lib/rules-engine/effects/EffectPool.ts"
import type { TurnState } from "#lib/rules-engine/turn-resolution/TurnState.ts"
import type { Ruleset } from "#lib/ruleset/Ruleset.ts"

export type TurnContext = {
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
