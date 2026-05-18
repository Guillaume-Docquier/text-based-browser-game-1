import type { FloatRange, IntegerRange } from "#lib/Range.ts"

export type Prng = {
  /**
   * Default range is [0, 1[
   */
  nextFloat: (range?: FloatRange) => number
  nextInteger: (range: IntegerRange) => number
  /**
   * Shuffles an array in place.
   */
  shuffle: <T>(values: T[]) => T[]
}

/**
 * Creates a deterministic pseudo-random number generator using the mulberry32 algorithm.
 */
export function createMulberry32Prng(seed: number): Prng {
  let state = seed >>> 0

  function prng(): number {
    state += 0x6d2b79f5
    let next = state
    next = Math.imul(next ^ (next >>> 15), next | 1)
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61)

    return ((next ^ (next >>> 14)) >>> 0) / 4294967296
  }

  function nextFloat(range?: FloatRange): number {
    if (range === undefined) {
      return prng()
    }

    return prng() * (range.max - range.min + 1) + range.min
  }

  function nextInteger(range: IntegerRange): number {
    return Math.floor(nextFloat(range))
  }

  /**
   * Fisher-Yates shuffle in place.
   */
  function shuffle<T>(values: T[]): T[] {
    for (let i = values.length - 1; i > 0; i--) {
      const j = Math.floor(prng() * (i + 1))
      ;[values[i], values[j]] = [values[j] as T, values[i] as T]
    }

    return values
  }

  return {
    nextFloat,
    nextInteger,
    shuffle,
  }
}
