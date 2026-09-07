import { z } from "zod"
import { ActionIdSchema } from "#lib/db/actions/ActionId.ts"

export type SubmittedActionTargetsDto = z.infer<typeof SubmittedActionTargetsDtoSchema>
export const SubmittedActionTargetsDtoSchema = z.object({
  actionId: ActionIdSchema,
  /**
   * null when un-selecting, object when selecting / updating targets
   */
  targets: z.record(z.string(), z.string()).nullable(),
})
