import { branded, type Branded } from "@guillaume-docquier/tools-ts"
import { z } from "zod"
import { PlayerIdSchema } from "#shared/domain/players/PlayerId.ts"
import { PlanetIdSchema } from "#shared/domain/world/planets/PlanetId.ts"
import { StarIdSchema } from "#shared/domain/world/stars/StarId.ts"
import { TripSchema } from "./travel.ts"

export type ShipId = Branded<"ShipId", string>
export const ShipIdSchema = z
  .string()
  .min(1)
  .transform(branded<ShipId>)
export const ShipType = { TRANSPORT: "TRANSPORT" } as const
export type ShipType = (typeof ShipType)[keyof typeof ShipType]

export const ShipSchema = z.object({
  id: ShipIdSchema,
  type: z.enum(ShipType),
  ownerPlayerId: PlayerIdSchema,
  planetId: PlanetIdSchema.nullable(),
  starId: StarIdSchema.nullable(),
  trip: TripSchema.nullable(),
})
export type Ship = z.infer<typeof ShipSchema>

export const SHIP_TEMPLATES = {
  [ShipType.TRANSPORT]: { type: ShipType.TRANSPORT, thrust: 64, emptyMass: 4, cargoSize: 4 },
  SCOUT: { type: "SCOUT", thrust: 16, emptyMass: 0.25, cargoSize: 1 },
  COLONY_SHIP: { type: "COLONY_SHIP", thrust: 64, emptyMass: 4, cargoSize: 0 },
} as const
