import { Range, type Rng, type XY } from "@guillaume-docquier/tools-ts"

export type StarTopology = XY

export function starTopologyGenerator(position: XY, rng: Rng): StarTopology {
  return {
    ...position,
    name: starNameGenerator(rng),
  }
}

const INT_RANGE = Range.integer({ min: 999, max: 999999 })
function starNameGenerator(rng: Rng): string {
  return `star ${rng.int(INT_RANGE)}`
}
