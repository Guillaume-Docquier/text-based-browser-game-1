import type { Effect } from "#lib/rules-engine/effects/Effect.ts"

type EffectOutcomeBase = {
  readonly effectId: Effect["id"]
  readonly effectType: Effect["type"]
}

/**
 * The recorded result of attempting to resolve one Effect.
 */
export type EffectOutcome =
  | (EffectOutcomeBase & {
      readonly status: "SUCCEEDED"
    })
  | (EffectOutcomeBase & {
      readonly status: "PREVENTED"
      readonly reason: "COST_PAYMENT_FAILED" | "WINNER_ALREADY_SELECTED"
    })
  | (EffectOutcomeBase & {
      readonly status: "FAILED"
      readonly reason: "INSUFFICIENT_RESOURCES"
    })

function fromEffect(effect: Effect): EffectOutcomeBase {
  return {
    effectId: effect.id,
    effectType: effect.type,
  }
}

/**
 * Constructors for Effect resolution outcomes.
 */
export const EffectOutcome = {
  succeeded: (effect: Effect): EffectOutcome => ({
    ...fromEffect(effect),
    status: "SUCCEEDED",
  }),
  prevented: (effect: Effect, reason: Extract<EffectOutcome, { status: "PREVENTED" }>["reason"]): EffectOutcome => ({
    ...fromEffect(effect),
    status: "PREVENTED",
    reason,
  }),
  failed: (effect: Effect, reason: Extract<EffectOutcome, { status: "FAILED" }>["reason"]): EffectOutcome => ({
    ...fromEffect(effect),
    status: "FAILED",
    reason,
  }),
}
