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

/**
 * Maximum number of players supported by a game lobby.
 *
 * This has to be improved, it's not present in the schema validation and used ad-hoc in the frontend and backend.
 */
export const MAX_NB_SEATS = 16
