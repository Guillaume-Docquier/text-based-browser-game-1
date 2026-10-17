import { ActionIdSchema } from "shared/domain/turns/actions/ActionId.ts"
import { SelectedTargetsSchema } from "shared/domain/turns/actions/SelectedTargets.ts"
import { z } from "zod"

export type SubmittedActionTargets = z.infer<typeof SubmittedActionTargetsSchema>
export const SubmittedActionTargetsSchema = z.object({
  actionId: ActionIdSchema,
  /**
   * null when un-selecting, object when selecting / updating selected targets.
   * Is an empty object when the action is selected but has not targets to specify.
   */
  selectedTargets: SelectedTargetsSchema.nullable(),
})
