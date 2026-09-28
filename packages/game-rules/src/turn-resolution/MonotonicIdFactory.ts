/**
 * Creates numeric ids in a sequence.
 */
export type MonotonicIdFactory = () => number

export const MonotonicIdFactory = {
  create: (): MonotonicIdFactory => {
    let id = 0
    return () => id++
  },
}
