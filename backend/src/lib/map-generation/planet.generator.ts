import { Range, type Rng } from "@guillaume-docquier/tools-ts"
import type { Point2D } from "#lib/map-generation/points/Point2D.ts"

export type Planet = {
  x: number
  y: number
  name: string
}

const ANGLE_RANGE = Range.float({ min: 0, max: 2 * Math.PI })
export function planetGenerator(starPosition: Point2D, orbitDistance: number, rng: Rng): Planet {
  const angle = rng.float(ANGLE_RANGE)

  return {
    x: starPosition.x + orbitDistance * Math.cos(angle),
    y: starPosition.y + orbitDistance * Math.sin(angle),
    name: planetNameGenerator(rng),
  }
}

// To be improved
const INT_RANGE = Range.integer({ min: 999, max: 999999 })
function planetNameGenerator(rng: Rng): string {
  return `planet ${rng.int(INT_RANGE)}`
}
