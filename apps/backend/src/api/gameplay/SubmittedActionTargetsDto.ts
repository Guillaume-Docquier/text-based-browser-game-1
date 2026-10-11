import { ActionIdSchema } from "shared/domain/turns/actions/ActionId.ts"
import { SelectedInputsSchema } from "shared/domain/turns/actions/SelectedInputs.ts"
import { SelectedTargetsSchema } from "shared/domain/turns/actions/SelectedTargets.ts"
import { z } from "zod"

export type SubmittedActionTargetsDto = z.infer<typeof SubmittedActionTargetsDtoSchema>
export const SubmittedActionTargetsDtoSchema = z.union([
  z.object({ actionId: ActionIdSchema, selectedTargets: z.null(), selectedInputs: z.null() }),
  z.object({ actionId: ActionIdSchema, selectedTargets: SelectedTargetsSchema, selectedInputs: SelectedInputsSchema }),
])
