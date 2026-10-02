import { z } from "zod"
import { PlayerIdSchema, type PlayerId } from "#shared/domain/players/PlayerId.ts"
import { PlanetBiomeSchema, type PlanetBiome } from "#shared/domain/world/planets/PlanetBiome.ts"
import { PlanetCoordinatesSchema, type PlanetCoordinates } from "#shared/domain/world/planets/PlanetCoordinates.ts"
import { PlanetIdSchema, type PlanetId } from "#shared/domain/world/planets/PlanetId.ts"
import { PlanetNameSchema, type PlanetName } from "#shared/domain/world/planets/PlanetName.ts"
import { PlanetSizeSchema, type PlanetSize } from "#shared/domain/world/planets/PlanetSize.ts"

export type Planet = {
  readonly id: PlanetId
  readonly ownerPlayerId: PlayerId | null
  readonly name: PlanetName
  readonly coordinates: PlanetCoordinates
  readonly x: number
  readonly y: number
  readonly biome: PlanetBiome
  readonly size: PlanetSize
  readonly fertility: number
  readonly metal: number
  readonly fuel: number
  readonly energy: number
  readonly maxPopulation: number
  readonly area: number
}

export const PlanetSchema = z.object({
  id: PlanetIdSchema,
  ownerPlayerId: PlayerIdSchema.nullable(),
  name: PlanetNameSchema,
  coordinates: PlanetCoordinatesSchema,
  x: z.number(),
  y: z.number(),
  biome: PlanetBiomeSchema,
  size: PlanetSizeSchema,
  fertility: z.number(),
  metal: z.number(),
  fuel: z.number(),
  energy: z.number(),
  maxPopulation: z.number(),
  area: z.number(),
}) satisfies z.ZodType<Planet>
