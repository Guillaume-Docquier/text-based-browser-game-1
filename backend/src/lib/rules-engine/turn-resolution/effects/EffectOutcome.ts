/**
 * The outcome when an effect resolves normally.
 */
export type EffectOutcome = EffectResolved | EffectPrevented

/**
 * The effect fully resolved.
 */
type EffectResolved = Readonly<{ type: "RESOLVED"; result: string }>

/**
 * The effect did not resolve because it was prevented by other normal events.
 * This usually happen when multiple effects compete for something.
 */
type EffectPrevented = Readonly<{ type: "PREVENTED"; reason: string }>

export const EffectOutcome = {
  Resolved: ({ result }: Omit<EffectResolved, "type">): EffectResolved => {
    return {
      type: "RESOLVED",
      result,
    }
  },
  Prevented: ({ reason }: Omit<EffectPrevented, "type">): EffectPrevented => {
    return {
      type: "PREVENTED",
      reason,
    }
  },
}
