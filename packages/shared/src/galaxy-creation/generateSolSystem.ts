import { Assert, Range, type Rng } from "@guillaume-docquier/tools-ts"
import { SOL_PLANETS, SUN_ID } from "#shared/domain/world/Sol.ts"
import type { StarSystem } from "#shared/domain/world/StarSystem.ts"
import { generatePlanetAttributes } from "#shared/galaxy-creation/attributes/generatePlanetAttributes.ts"
import { planetTopologyGenerator } from "#shared/galaxy-creation/topology/planetTopologyGenerator.ts"

export function generateSolSystem(systems: readonly StarSystem[], center: number, rng: Rng): StarSystem {
  const candidates = systems.filter(({ star }) => Math.hypot(star.x - center, star.y - center) <= 5)
  Assert.isTrue(candidates.length > 0)
  const selected = candidates[rng.int(Range.integer({ min: 0, max: candidates.length - 1 }))]
  Assert.isDefined(selected)
  const star = { ...selected.star, id: SUN_ID, name: "Sun" }
  const planets = SOL_PLANETS.map((body) =>
    generatePlanetAttributes({
      planet: planetTopologyGenerator(star, body.orbitAU, rng),
      planetKey: body.name,
      starCoordinates: star.coordinates,
      body,
      rng,
    }),
  )
  return { star, planets }
}
