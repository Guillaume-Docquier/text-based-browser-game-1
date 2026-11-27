import { Range, type Rng } from "@guillaume-docquier/tools-ts"

const NAME_SUFFIX_RANGE = Range.integer({ min: 999, max: 999999 })

export function generateName(kind: "star" | "planet", rng: Rng): string {
  return `${kind} ${rng.int(NAME_SUFFIX_RANGE)}`
}
