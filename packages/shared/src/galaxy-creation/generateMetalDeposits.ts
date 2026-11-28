import { Range, type Rng } from "@guillaume-docquier/tools-ts"
import type { Galaxy } from "#shared/domain/world/Galaxy.ts"
import { PlanetBiome } from "#shared/domain/world/planets/PlanetBiome.ts"
import { SUN_ID } from "#shared/domain/world/Sol.ts"

const METALLIC = {
  chance: 0.75,
  deposit: Range.integer({ min: 10, max: 20 }),
  production: Range.integer({ min: 2, max: 4 }),
}
const OTHER = {
  chance: 0.25,
  deposit: Range.integer({ min: 5, max: 15 }),
  production: Range.integer({ min: 1, max: 3 }),
}

export function generateMetalDeposits(galaxy: Galaxy, rng: Rng): Galaxy {
  return {
    systems: galaxy.systems.map((system) => {
      if (system.star.id === SUN_ID || system.planets.some((planet) => planet.ownerPlayerId !== null)) {
        return system
      }
      const planets = system.planets.map((planet) => {
        if (planet.biome === PlanetBiome.GAS) {
          return planet
        }
        const rolls = planet.biome === PlanetBiome.METALLIC ? METALLIC : OTHER
        if (rng.float() >= rolls.chance) {
          return planet
        }
        return { ...planet, remainingMetalDeposit: rng.int(rolls.deposit), metalProduction: rng.int(rolls.production) }
      })
      return { star: system.star, planets }
    }),
  }
}
