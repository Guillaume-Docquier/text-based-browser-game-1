import { mulberry32Prng, Rng } from "@guillaume-docquier/tools-ts"

export function createSeededRng(seed = 1234): Rng {
  return Rng.create(mulberry32Prng(seed))
}
