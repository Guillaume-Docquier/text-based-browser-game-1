import type { ActionSubmission } from "#lib/rules-engine/action-submission/ActionSubmission.ts"
import type { EffectOutcome } from "#lib/rules-engine/turn-resolution/effects/EffectOutcome.ts"

/**
 * The resolved action payload after turn resolution.
 */
export type ResolvedAction = Readonly<{
  /**
   * The original action submission
   */
  actionSubmission: ActionSubmission
  /**
   * Every outcome related to the action submission
   */
  actionOutcomes: readonly EffectOutcome[]
}>
