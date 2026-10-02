import { EffectOutcome } from "#shared/domain/actions/EffectOutcome.ts"

/**
 * Build an applied effect outcome with test-specific text.
 */
export function createEffectOutcomeStub({ result = "Effect applied" }: { result?: string } = {}): EffectOutcome {
  return EffectOutcome.Resolved({ result })
}

/**
 * Build an effect outcome prevented by a normal game event.
 */
export function createPreventedEffectOutcomeStub({ reason = "Effect prevented" }: { reason?: string } = {}): EffectOutcome {
  return EffectOutcome.Prevented({ reason })
}
