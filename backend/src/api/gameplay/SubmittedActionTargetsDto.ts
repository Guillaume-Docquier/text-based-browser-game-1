import { z } from "zod"
import { ActionIdSchema } from "#lib/db/actions/ActionId.ts"
import { SelectedTargetsSchema } from "#lib/rules-engine/ruleset-model/actions/SelectedTargets.ts"

export type SubmittedActionTargetsDto = z.infer<typeof SubmittedActionTargetsDtoSchema>
export const SubmittedActionTargetsDtoSchema = z.object({
  actionId: ActionIdSchema,
  /**
   * null when un-selecting, object when selecting / updating selected targets
   */
  selectedTargets: SelectedTargetsSchema.nullable(),
})
