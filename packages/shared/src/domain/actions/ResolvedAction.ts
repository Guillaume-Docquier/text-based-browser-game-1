import { z } from "zod"
import type { SubmittedAction } from "#shared/domain/actions/Action.ts"
import { SubmittedActionSchema } from "#shared/domain/actions/Action.ts"
import { EffectOutcomeSchema, type EffectOutcome } from "#shared/domain/actions/EffectOutcome.ts"

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

/**
 * Parses a submitted action together with the outcomes recorded during resolution.
 */
export const ResolvedActionSchema = z.object({
  submittedAction: SubmittedActionSchema,
  actionOutcomes: z.array(EffectOutcomeSchema).readonly(),
}) satisfies z.ZodType<ResolvedAction>
