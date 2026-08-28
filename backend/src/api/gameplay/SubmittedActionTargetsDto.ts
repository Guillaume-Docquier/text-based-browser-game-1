import { z } from "zod"

export type SubmittedActionTargetsDto = z.infer<typeof SubmittedActionTargetsDto>
export const SubmittedActionTargetsDto = z.object({
  actionId: z.string(),
  /**
   * null when un-selecting, object when selecting / updating targets
   */
  targets: z.record(z.string(), z.string()).nullable(),
})
