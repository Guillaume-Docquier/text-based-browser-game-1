export const Datetime = {
  /**
   * Increments a date by x seconds
   * A unit agnostic utility would be useful here
   */
  increment: ({ date, incrementSeconds }: { date: Date; incrementSeconds: number }): Date => {
    return new Date(date.getTime() + incrementSeconds * 1000)
  },
}
