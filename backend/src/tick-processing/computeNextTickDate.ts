/**
 * Computes the date at which the next tick should happen.
 * The date argument is the last tick date to which we'll add tickIntervalSeconds.
 */
export function computeNextTickDate({ date, tickIntervalSeconds }: { date: Date; tickIntervalSeconds: number }): Date {
  return new Date(date.getTime() + tickIntervalSeconds * 1000)
}
