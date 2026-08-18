import type { EffectError } from "#lib/rules-engine/turn-resolution/effects/EffectError.ts"

export type ResolvePhaseError = FailedEffect
type FailedEffect = { _tag: "FAILED_TO_RESOLVE_EFFECT"; error: EffectError }

export const ResolvePhaseError = {
  FailedEffect: ({ error }: Omit<FailedEffect, "_tag">): FailedEffect => {
    return {
      _tag: "FAILED_TO_RESOLVE_EFFECT",
      error,
    }
  },
}
