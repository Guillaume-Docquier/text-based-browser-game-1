import { branded, type Branded } from "@guillaume-docquier/tools-ts"
import { z } from "zod"
import { PlayerIdSchema } from "#shared/domain/players/PlayerId.ts"
import { PlanetIdSchema } from "#shared/domain/world/planets/PlanetId.ts"

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
  planetId: PlanetIdSchema,
})
export type Ship = z.infer<typeof ShipSchema>

export const SHIP_TEMPLATES = {
  [ShipType.TRANSPORT]: { type: ShipType.TRANSPORT, thrust: 64, emptyMass: 4, cargoSize: 4 },
} as const satisfies Record<ShipType, { type: ShipType; thrust: number; emptyMass: number; cargoSize: number }>
