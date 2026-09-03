import { z } from "zod"
import { ActionId } from "#lib/rules-engine/action-submission/Action.ts"

export type SubmittedActionTargetsDto = z.infer<typeof SubmittedActionTargetsDto>
export const SubmittedActionTargetsDto = z.object({
  actionId: ActionId,
  /**
   * null when un-selecting, object when selecting / updating targets
   */
  targets: z.record(z.string(), z.string()).nullable(),
})
