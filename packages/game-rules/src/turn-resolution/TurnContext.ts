import type { Rng } from "@guillaume-docquier/tools-ts"
import type { CompiledRuleset } from "#game-rules/ruleset/CompiledRuleset.ts"
import type { EffectPool } from "#game-rules/turn-resolution/effects/EffectPool.ts"
import type { TurnState } from "#game-rules/turn-resolution/TurnState.ts"

export type TurnContext = Readonly<{
  /**
   * Rng when you need it.
   * Will be seeded and persisted so runs are fully deterministic.
   */
  rng: Rng
  /**
   * The turn state, to mutate.
   */
  turnState: TurnState
  /**
   * All the Effects that need resolving, to mutate.
   */
  effectPool: EffectPool
  /**
   * The rules for this turn.
   */
  ruleset: CompiledRuleset
}>
