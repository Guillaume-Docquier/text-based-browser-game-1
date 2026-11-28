import { branded, type Branded } from "@guillaume-docquier/tools-ts"
import { z } from "zod"
import { PlanetIdSchema } from "#shared/domain/world/planets/PlanetId.ts"

export type BuildingId = Branded<"BuildingId", string>
export const TRADE_CENTER_INCOME = 10
export const BuildingType = { COMMAND_CENTER: "COMMAND_CENTER", TRADE_CENTER: "TRADE_CENTER" } as const
export type BuildingType = (typeof BuildingType)[keyof typeof BuildingType]

export const BuildingSchema = z.object({
  id: z.uuid().transform(branded<BuildingId>),
  type: z.enum(BuildingType),
  planetId: PlanetIdSchema,
  site: z.int().nonnegative(),
})
export type Building = z.infer<typeof BuildingSchema>
