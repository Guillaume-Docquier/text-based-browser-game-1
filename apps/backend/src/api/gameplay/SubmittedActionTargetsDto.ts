import { SelectedTargetsSchema } from "game-rules/action-submission/SelectedTargets.ts"
import { ActionIdSchema } from "game-rules/models/ActionId.ts"
import { z } from "zod"

export type SubmittedActionTargetsDto = z.infer<typeof SubmittedActionTargetsDtoSchema>
export const SubmittedActionTargetsDtoSchema = z.object({
  actionId: ActionIdSchema,
  /**
   * null when un-selecting, object when selecting / updating selected targets
   */
  selectedTargets: SelectedTargetsSchema.nullable(),
})
