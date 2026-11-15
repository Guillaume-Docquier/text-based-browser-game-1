export type Clock = typeof Clock
export const Clock = {
  // oxlint-disable-next-line no-restricted-globals -- This is the clock
  now: () => new Date(),
} as const
