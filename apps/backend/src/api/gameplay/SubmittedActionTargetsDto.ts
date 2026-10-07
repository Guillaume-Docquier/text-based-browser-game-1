import { ActionIdSchema } from "shared/domain/turns/actions/ActionId.ts"
import { SelectedTargetsSchema } from "shared/domain/turns/actions/SelectedTargets.ts"
import { z } from "zod"

export type SubmittedActionTargetsDto = z.infer<typeof SubmittedActionTargetsDtoSchema>
export const SubmittedActionTargetsDtoSchema = z.object({
  actionId: ActionIdSchema,
  /**
   * null when un-selecting, object when selecting / updating selected targets
   */
  selectedTargets: SelectedTargetsSchema.nullable(),
})
