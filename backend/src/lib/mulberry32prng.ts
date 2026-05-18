export type Prng = () => number

export function createMulberry32Prng(seed: number): Prng {
  let state = seed >>> 0

  return () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)

    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296
  }
}

export function randomUint32(prng: Prng): number {
  return Math.floor(prng() * 4_294_967_296) >>> 0
}
