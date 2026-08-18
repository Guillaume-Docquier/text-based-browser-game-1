import type { Rng } from "@guillaume-docquier/tools-ts"
import type { Ruleset } from "#lib/rules-engine/ruleset-model/Ruleset.ts"
import type { EffectPool } from "#lib/rules-engine/turn-resolution/effects/EffectPool.ts"
import type { TurnState } from "#lib/rules-engine/turn-resolution/TurnState.ts"

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
  ruleset: Ruleset
}>
