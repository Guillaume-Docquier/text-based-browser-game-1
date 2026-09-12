import type { PlanetCoordinates } from "#api/shared/PlanetCoordinates.ts"
import type { PlanetBiome } from "#lib/db/planets/PlanetBiome.ts"
import type { PlanetId } from "#lib/db/planets/PlanetId.ts"
import type { PlanetSize } from "#lib/db/planets/PlanetSize.ts"
import type { PlayerId } from "#lib/db/players/PlayerId.ts"

export type PlanetModel = {
  readonly id: PlanetId
  readonly ownerPlayerId: PlayerId | null
  readonly name: string
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
