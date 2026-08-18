/**
 * The error when an effect could not be resolved because of problems, probably bugs.
 */
export type EffectError = EffectFailed

/**
 * An effect failed to resolve because something was missing.
 */
type EffectFailed = { _tag: "FAILED"; error: string }

export const EffectError = {
  Failed: ({ error }: Omit<EffectFailed, "_tag">): EffectFailed => {
    return {
      _tag: "FAILED",
      error,
    }
  },
}
