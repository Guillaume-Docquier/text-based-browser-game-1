import type { PlanetId } from "game-rules/models/PlanetId.ts"
import type { PlanetName } from "game-rules/models/PlanetName.ts"
import type { PlayerId } from "game-rules/models/PlayerId.ts"
import type { PlanetCoordinates } from "#api/gameplay/galaxy-creation/PlanetCoordinates.ts"
import type { PlanetBiome } from "#lib/db/planets/PlanetBiome.ts"
import type { PlanetSize } from "#lib/db/planets/PlanetSize.ts"

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
