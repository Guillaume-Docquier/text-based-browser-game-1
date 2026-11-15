import { RulesetIdSchema } from "shared/domain/ruleset/RulesetId.ts"
import { z } from "zod"

export type RulesetSummary = z.infer<typeof RulesetSummarySchema>
export const RulesetSummarySchema = z.object({
  id: RulesetIdSchema,
  name: z.string(),
  isDefault: z.boolean(),
})
