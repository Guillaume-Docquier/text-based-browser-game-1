import { Assert } from "@guillaume-docquier/tools-ts"

export type Mulberry32Prng = {
  nextFloat: () => number
  nextInteger: (range: { min: number; max: number }) => number
  shuffle: <T>(values: T[]) => T[]
}

export function createMulberry32Prng(seed: number): Mulberry32Prng {
  let state = seed >>> 0

  function nextFloat(): number {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)

    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }

  return {
    nextFloat,
    nextInteger: ({ min, max }) => Math.floor(nextFloat() * (max - min + 1)) + min,
    shuffle: <T>(values: T[]): T[] => {
      const shuffled = [...values]
      for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(nextFloat() * (index + 1))
        const value = shuffled[index]
        const swapValue = shuffled[swapIndex]
        Assert.isDefined(value)
        Assert.isDefined(swapValue)
        shuffled[index] = swapValue
        shuffled[swapIndex] = value
      }

      return shuffled
    },
  }
}
