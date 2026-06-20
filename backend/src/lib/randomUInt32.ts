export const MAX_UINT_32 = 0xffffffff

export function randomUInt32(): number {
  return Math.floor(Math.random() * (MAX_UINT_32 + 1)) // + 1 because Math.random() is [0, 1)
}
