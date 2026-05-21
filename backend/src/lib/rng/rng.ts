import type { FloatRange, IntegerRange } from "#lib/Range.ts"

/**
 * A generator that returns numbers in the range [0, 1)
 */
export type Generator = () => number

export type Rng = {
  /**
   * When no range is provided, returns a float in the range [0, 1).
   * If Range is provided, it is inclusive if min is bigger than 1 because of floating point errors.
   * min > 1: [min, max]
   * min <= 1: [min, max)
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

  /**
   * Draws a number of elements without modifying the original array.
   */
  draw: <T>(values: T[], count: number) => { drawn: T[]; remaining: T[] }
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
    // We +1 the max because float is exclusive of the max, but for int we want the range to be inclusive.
    // We floor before the addition, because the addition can lose precision and generate numbers that are out of bounds when float ~= 1.
    // We don't use Math.floor(float(rangeWithMaxPlus1)) for the same reason
    return range.min + Math.floor(float() * (range.max + 1 - range.min))
  }

  /**
   * Fisher-Yates shuffle in place.
   */
  function shuffle<T>(values: Array<Readonly<T>>): T[] {
    for (let i = values.length - 1; i > 0; i--) {
      const j = Math.floor(generate() * (i + 1))
      ;[values[i], values[j]] = [values[j] as T, values[i] as T]
    }

    return values
  }

  function draw<T>(values: ReadonlyArray<Readonly<T>>, count: number): { drawn: T[]; remaining: T[] } {
    const shuffled = shuffle(values.slice())

    return {
      drawn: shuffled,
      remaining: shuffled.splice(count),
    }
  }

  return {
    float,
    int,
    shuffle,
    draw,
  }
}
