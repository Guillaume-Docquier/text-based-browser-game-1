/**
 * The outcome when an effect resolves normally.
 */
export type EffectOutcome = EffectResolved | EffectPrevented

/**
 * The effect fully resolved.
 */
type EffectResolved = { _tag: "RESOLVED"; result: string }

/**
 * The effect did not resolve because it was prevented by other normal events.
 * This usually happen when multiple effects compete for something.
 */
type EffectPrevented = { _tag: "PREVENTED"; reason: string }

export const EffectOutcome = {
  Resolved: ({ result }: Omit<EffectResolved, "_tag">): EffectResolved => {
    return {
      _tag: "RESOLVED",
      result,
    }
  },
  Prevented: ({ reason }: Omit<EffectPrevented, "_tag">): EffectPrevented => {
    return {
      _tag: "PREVENTED",
      reason,
    }
  },
}
