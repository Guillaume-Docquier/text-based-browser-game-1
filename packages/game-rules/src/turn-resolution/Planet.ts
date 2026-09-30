import type { PlanetId } from "#game-rules/models/PlanetId.ts"
import type { PlanetName } from "#game-rules/models/PlanetName.ts"
import type { PlayerId } from "#game-rules/models/PlayerId.ts"

export type Planet = {
  readonly id: PlanetId
  readonly name: PlanetName
  readonly ownerPlayerId: PlayerId | null
  readonly x: number
  readonly y: number
}
