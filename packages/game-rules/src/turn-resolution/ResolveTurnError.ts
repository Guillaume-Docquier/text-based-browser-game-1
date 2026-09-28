import type { SubmittedActionIssue } from "game-rules/action-submission/validation/SubmittedActionIssue.ts"
import type { EffectJson } from "game-rules/turn-resolution/effects/EffectJson.ts"
import type { ResolvePhaseError } from "game-rules/turn-resolution/phases/ResolvePhaseError.ts"

export type ResolveTurnError = InvalidSubmissions | FailedToResolvePhases | UnresolvedEffects
type InvalidSubmissions = Readonly<{ type: "INVALID_SUBMISSIONS"; issues: SubmittedActionIssue[] }>
type FailedToResolvePhases = Readonly<{ type: "FAILED_TO_RESOLVE_PHASES"; error: ResolvePhaseError }>
type UnresolvedEffects = Readonly<{ type: "UNRESOLVED_EFFECTS"; effects: EffectJson[] }>

export const ResolveTurnError = {
  InvalidSubmissions: ({ issues }: Omit<InvalidSubmissions, "type">): InvalidSubmissions => {
    return {
      type: "INVALID_SUBMISSIONS",
      issues,
    }
  },
  FailedToResolvePhases: ({ error }: Omit<FailedToResolvePhases, "type">): FailedToResolvePhases => {
    return {
      type: "FAILED_TO_RESOLVE_PHASES",
      error,
    }
  },
  UnresolvedEffects: ({ effects }: Omit<UnresolvedEffects, "type">): UnresolvedEffects => {
    return {
      type: "UNRESOLVED_EFFECTS",
      effects,
    }
  },
}
