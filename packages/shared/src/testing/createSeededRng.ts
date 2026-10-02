import { mulberry32Prng, Rng } from "@guillaume-docquier/tools-ts"

/**
 * Creates a deterministic RNG for tests from a repeatable seed.
 */
export function createSeededRng(seed = 1234): Rng {
  return Rng.create(mulberry32Prng(seed))
}
