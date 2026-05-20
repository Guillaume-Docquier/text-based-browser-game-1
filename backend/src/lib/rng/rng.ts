import type { FloatRange, IntegerRange } from "#lib/Range.ts"

/**
 * A generator that returns numbers in the range [0, 1)
 */
export type Generator = () => number

export type Rng = {
  /**
   * Range is exclusive, the default range is [0, 1)
   */
  float: (range?: FloatRange) => number

  /**
   * Range is inclusive.
   */
  int: (range: IntegerRange) => number

  /**
   * Shuffles an array in place.
   */
  shuffle: <T>(values: T[]) => T[]
}

/**
 * Creates a random number generator based on your generator of choice.
 * @param generate The generator that returns numbers in the range [0, 1)
 */
export function createRng(generate: () => number): Rng {
  function float(range?: FloatRange): number {
    if (range === undefined) {
      return generate()
    }

    return range.min + generate() * (range.max - range.min)
  }

  function int(range: IntegerRange): number {
    // We +1 the max because float is exclusive of the max, but for int we want it to be inclusive
    return Math.floor(float({ ...range, max: range.max + 1 }))
  }

  /**
   * Fisher-Yates shuffle in place.
   */
  function shuffle<T>(values: T[]): T[] {
    for (let i = values.length - 1; i > 0; i--) {
      const j = Math.floor(generate() * (i + 1))
      ;[values[i], values[j]] = [values[j] as T, values[i] as T]
    }

    return values
  }

  return {
    float,
    int,
    shuffle,
  }
}
