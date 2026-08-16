import { createRng, mulberry32Prng, type Rng } from "@guillaume-docquier/tools-ts"

export function createSeededRng(seed = 1234): Rng {
  return createRng(mulberry32Prng(seed))
}
