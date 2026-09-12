import type { PlanetModel } from "./PlanetModel.ts"
import type { StarModel } from "./StarModel.ts"

export type GalaxySystemModel = {
  readonly star: StarModel
  readonly planets: readonly PlanetModel[]
}

export type GalaxyModel = {
  readonly systems: readonly GalaxySystemModel[]
}
