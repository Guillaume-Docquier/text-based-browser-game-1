import { ActionIdSchema } from "shared/domain/turns/actions/ActionId.ts"
import { SelectedInputsSchema } from "shared/domain/turns/actions/SelectedInputs.ts"
import { SelectedTargetsSchema } from "shared/domain/turns/actions/SelectedTargets.ts"
import { z } from "zod"

export type SubmittedActionTargetsDto = z.infer<typeof SubmittedActionTargetsDtoSchema>
export const SubmittedActionTargetsDtoSchema = z
  .object({
    actionId: ActionIdSchema,
    /**
     * Both fields are null when un-selecting and objects when selecting or updating an Action.
     */
    selectedTargets: SelectedTargetsSchema.nullable(),
    selectedInputs: SelectedInputsSchema.nullable(),
  })
  .superRefine((selection, context) => {
    if ((selection.selectedTargets === null) !== (selection.selectedInputs === null)) {
      context.addIssue({ code: "custom", message: "Selected targets and inputs must both be null or both be objects" })
    }
  })
