export type Clock = typeof Clock
export const Clock = {
  now: () => new Date(),
} as const
