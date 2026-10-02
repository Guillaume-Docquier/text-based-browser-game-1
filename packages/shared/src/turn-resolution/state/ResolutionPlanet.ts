import type { Planet } from "#shared/domain/world/planets/Planet.ts"

/**
 * The slim turn-resolution view of a planet's identity, ownership, and location.
 */
export type ResolutionPlanet = Pick<Planet, "id" | "name" | "ownerPlayerId" | "x" | "y">
