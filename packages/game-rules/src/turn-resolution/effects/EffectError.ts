/**
 * The error when an effect could not be resolved because of problems, probably bugs.
 */
export type EffectError = EffectFailed

/**
 * An effect failed to resolve because something was missing.
 */
type EffectFailed = Readonly<{ type: "FAILED"; error: string }>

export const EffectError = {
  Failed: ({ error }: Omit<EffectFailed, "type">): EffectFailed => {
    return {
      type: "FAILED",
      error,
    }
  },
}
