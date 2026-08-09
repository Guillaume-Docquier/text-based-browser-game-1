export const UInt32 = {
  max: 0xffffffff,
  random: (): number => Math.floor(Math.random() * (UInt32.max + 1)), // + 1 because Math.random() is [0, 1)
  validate: (value: number): boolean => Number.isInteger(value) && value >= 0 && value <= UInt32.max,
} as const
