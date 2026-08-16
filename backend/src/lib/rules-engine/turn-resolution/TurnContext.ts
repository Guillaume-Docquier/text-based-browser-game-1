import type { Ruleset } from "#lib/rules-engine/ruleset/Ruleset.ts"
import type { EffectPool } from "#lib/rules-engine/turn-resolution/effects/EffectPool.ts"
import type { TurnState } from "#lib/rules-engine/turn-resolution/TurnState.ts"

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
