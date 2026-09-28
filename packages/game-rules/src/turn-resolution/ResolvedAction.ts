import type { SubmittedAction } from "#game-rules/action-submission/Action.ts"
import type { EffectOutcome } from "#game-rules/turn-resolution/effects/EffectOutcome.ts"

/**
 * The resolved action payload after turn resolution.
 */
export type ResolvedAction = Readonly<{
  /**
   * The original action submission
   */
  submittedAction: SubmittedAction
  /**
   * Every outcome related to the action submission
   */
  actionOutcomes: readonly EffectOutcome[]
}>
