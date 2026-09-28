import { Range, type Rng, type XY } from "@guillaume-docquier/tools-ts"

export type GeneratedStar = {
  x: number
  y: number
  name: string
}

export function starGenerator(position: XY, rng: Rng): GeneratedStar {
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
