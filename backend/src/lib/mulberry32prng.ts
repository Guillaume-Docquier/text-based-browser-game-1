export type Prng = () => number

/**
 * Deterministic pseudo-random number generator.
 *
 * Returns numbers in [0, 1).
 */
export function mulberry32prng(seed: number): Prng {
  let state = seed >>> 0

  return () => {
    state += 0x6d2b79f5
    let next = state
    next = Math.imul(next ^ (next >>> 15), next | 1)
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61)

    return ((next ^ (next >>> 14)) >>> 0) / 4294967296
  }
}
