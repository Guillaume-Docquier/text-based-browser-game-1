import type { EffectJson } from "#lib/rules-engine/turn-resolution/effects/EffectJson.ts"

export type ResolvePhaseError = FailedEffect
export type FailedEffect = { _tag: "FAILED_TO_RESOLVE_EFFECT"; effect: EffectJson; issue: string }
