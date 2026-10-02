import type { Planet } from "#shared/domain/world/planets/Planet.ts"

export type ResolutionPlanet = Pick<Planet, "id" | "name" | "ownerPlayerId" | "x" | "y">
