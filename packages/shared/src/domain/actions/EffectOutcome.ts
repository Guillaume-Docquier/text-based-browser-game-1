import { z } from "zod"

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
} as const

/**
 * Parses the recorded result of resolving an effect.
 */
export const EffectOutcomeSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("RESOLVED"), result: z.string() }),
  z.object({ type: z.literal("PREVENTED"), reason: z.string() }),
]) satisfies z.ZodType<EffectOutcome>
