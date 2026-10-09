import { RulesetIdSchema } from "shared/domain/ruleset/RulesetId.ts"
import { z } from "zod"

/**
 * Public ruleset details used by game creation settings and game configuration.
 */
export type RulesetSummaryDto = z.infer<typeof RulesetSummaryDtoSchema>
export const RulesetSummaryDtoSchema = z.object({
  id: RulesetIdSchema,
  name: z.string(),
  isDefault: z.boolean(),
})
