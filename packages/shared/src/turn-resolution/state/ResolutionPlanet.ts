import type { Planet } from "#shared/domain/world/planets/Planet.ts"

export type ResolutionPlanet = Omit<Pick<Planet, "id" | "name" | "ownerPlayerId" | "x" | "y">, "ownerPlayerId"> & {
  ownerPlayerId: Planet["ownerPlayerId"]
}
