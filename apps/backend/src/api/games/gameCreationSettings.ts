import { z } from "zod"
import { RulesetSummarySchema } from "#api/games/RulesetSummary.ts"

export type GameCreationSettings = z.infer<typeof GameCreationSettingsSchema>
export const GameCreationSettingsSchema = z.object({
  rulesets: z.array(RulesetSummarySchema).readonly(),
})
