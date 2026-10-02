import { NonNegativeNumberSchema, type NonNegativeNumber } from "@guillaume-docquier/tools-ts/schemas"
import { z } from "zod"
import { PlayerIdSchema, type PlayerId } from "#shared/domain/players/PlayerId.ts"
import { FleetIdSchema, type FleetId } from "#shared/domain/world/fleets/FleetId.ts"
import { FleetNameSchema, type FleetName } from "#shared/domain/world/fleets/FleetName.ts"
import { PlanetIdSchema, type PlanetId } from "#shared/domain/world/planets/PlanetId.ts"

export type Fleet = Readonly<{
  id: FleetId
  ownerPlayerId: PlayerId
  name: FleetName
  strength: number
  originPlanetId: PlanetId
  destinationPlanetId?: PlanetId | undefined
  distanceToEnd?: NonNegativeNumber | undefined
}>

export const FleetSchema = z.object({
  id: FleetIdSchema,
  ownerPlayerId: PlayerIdSchema,
  name: FleetNameSchema,
  strength: z.number(),
  originPlanetId: PlanetIdSchema,
  destinationPlanetId: PlanetIdSchema.optional(),
  distanceToEnd: NonNegativeNumberSchema.optional(),
}) satisfies z.ZodType<Fleet>
