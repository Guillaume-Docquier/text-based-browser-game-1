import { z } from "zod"

export type GameConfiguration = Readonly<{
  name: string
  nbSeats: number
  turnIntervalSeconds: number
  mapGenerationSeed?: number
}>

export const GameConfigurationSchema = z
  .object({
    name: z.string(),
    nbSeats: z.number(),
    turnIntervalSeconds: z.number(),
    mapGenerationSeed: z.number().exactOptional(),
  })
  .readonly() satisfies z.ZodType<GameConfiguration>

export const MAX_NB_SEATS = 16
