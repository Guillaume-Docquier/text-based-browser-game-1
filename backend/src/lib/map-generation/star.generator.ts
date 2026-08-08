import { Range, type Rng } from "@guillaume-docquier/tools-ts"
import type { Point2D } from "#lib/map-generation/points/Point2D.ts"

export type Star = {
  x: number
  y: number
  name: string
}

export function starGenerator(position: Point2D, rng: Rng): Star {
  return {
    ...position,
    name: starNameGenerator(rng),
  }
}

// To be improved
const INT_RANGE = Range.integer({ min: 999, max: 999999 })
function starNameGenerator(rng: Rng): string {
  return `star ${rng.int(INT_RANGE)}`
}
