import { NonNegativeNumberSchema, type NonNegativeNumber } from "@guillaume-docquier/tools-ts/schemas"
import { z } from "zod"
import { PlayerIdSchema, type PlayerId } from "#shared/domain/players/PlayerId.ts"
import { FleetIdSchema, type FleetId } from "#shared/domain/world/fleets/FleetId.ts"
import { FleetNameSchema, type FleetName } from "#shared/domain/world/fleets/FleetName.ts"
import { PlanetIdSchema, type PlanetId } from "#shared/domain/world/planets/PlanetId.ts"

export type Fleet = {
  id: FleetId
  ownerPlayerId: PlayerId
  name: FleetName
  strength: number
  originPlanetId: PlanetId
  /**
   * Defined only when moving.
   * We'd use a discriminated union here, but since we mutate the fleet, it's a bit hard to do.
   */
  destinationPlanetId?: PlanetId | undefined
  /**
   * Defined only when moving.
   * We'd use a discriminated union here, but since we mutate the fleet, it's a bit hard to do.
   */
  distanceToEnd?: NonNegativeNumber | undefined
}

export const FleetSchema = z.object({
  id: FleetIdSchema,
  ownerPlayerId: PlayerIdSchema,
  name: FleetNameSchema,
  strength: z.number(),
  originPlanetId: PlanetIdSchema,
  destinationPlanetId: PlanetIdSchema.optional(),
  distanceToEnd: NonNegativeNumberSchema.optional(),
}) satisfies z.ZodType<Fleet>
