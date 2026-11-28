import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { PlanetBiome } from "#shared/domain/world/planets/PlanetBiome.ts"
import { PlanetSize } from "#shared/domain/world/planets/PlanetSize.ts"
import { StarIdSchema } from "#shared/domain/world/stars/StarId.ts"

export const SUN_ID = typedParse(StarIdSchema, "sun")

export const SOL_PLANETS = [
  { name: "Mercury", size: PlanetSize.SMALL, biome: PlanetBiome.METALLIC, orbitAU: 0.387 },
  { name: "Venus", size: PlanetSize.SMALL, biome: PlanetBiome.VOLCANIC, orbitAU: 0.723 },
  { name: "Earth", size: PlanetSize.SMALL, biome: PlanetBiome.OCEANIC, orbitAU: 1 },
  { name: "Mars", size: PlanetSize.SMALL, biome: PlanetBiome.VOLCANIC, orbitAU: 1.524 },
  { name: "Jupiter", size: PlanetSize.LARGE, biome: PlanetBiome.GAS, orbitAU: 5.203 },
  { name: "Saturn", size: PlanetSize.LARGE, biome: PlanetBiome.GAS, orbitAU: 9.537 },
  { name: "Uranus", size: PlanetSize.MEDIUM, biome: PlanetBiome.FROZEN, orbitAU: 19.191 },
  { name: "Neptune", size: PlanetSize.MEDIUM, biome: PlanetBiome.FROZEN, orbitAU: 30.069 },
] as const
