import { z } from "zod"
import { RulesetIdSchema, type RulesetId } from "#shared/domain/ruleset/RulesetId.ts"

export type GameConfiguration = Readonly<{
  name: string
  nbSeats: number
  turnIntervalSeconds: number
  mapGenerationSeed?: number
  rulesetId: RulesetId
}>

export const GameConfigurationSchema = z
  .object({
    name: z.string(),
    nbSeats: z.number(),
    turnIntervalSeconds: z.number(),
    mapGenerationSeed: z.number().exactOptional(),
    rulesetId: RulesetIdSchema,
  })
  .readonly() satisfies z.ZodType<GameConfiguration>
