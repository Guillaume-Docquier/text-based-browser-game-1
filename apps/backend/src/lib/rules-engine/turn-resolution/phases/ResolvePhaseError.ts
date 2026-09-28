import type { EffectError } from "#lib/rules-engine/turn-resolution/effects/EffectError.ts"

export type ResolvePhaseError = FailedEffect
type FailedEffect = Readonly<{ type: "FAILED_TO_RESOLVE_EFFECT"; error: EffectError }>

export const ResolvePhaseError = {
  FailedEffect: ({ error }: Omit<FailedEffect, "type">): FailedEffect => {
    return {
      type: "FAILED_TO_RESOLVE_EFFECT",
      error,
    }
  },
}
