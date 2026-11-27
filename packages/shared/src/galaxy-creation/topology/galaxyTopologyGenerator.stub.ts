import { Distance, UnitOfDistance } from "@guillaume-docquier/tools-ts"
import type { GalaxyTopology } from "#shared/galaxy-creation/topology/galaxyTopologyGenerator.ts"

export function createGalaxyTopologyStub(): GalaxyTopology {
  const width = 100
  return {
    width,
    height: 1,
    systems: Array.from({ length: width }, (_, x) => ({
      star: { x, y: 0 },
      planets: [5, 10, 15, 20, 25].map((orbitDistanceAU) => ({
        x: x + Distance.in(Distance.create(orbitDistanceAU, UnitOfDistance.ASTRONOMICAL_UNITS), UnitOfDistance.LIGHT_YEARS),
        y: 0,
        orbitDistanceAU,
      })),
    })),
  }
}
