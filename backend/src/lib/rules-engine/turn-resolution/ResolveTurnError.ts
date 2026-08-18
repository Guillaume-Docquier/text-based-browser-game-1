import type { ActionSubmissionIssue } from "#lib/rules-engine/action-submission/validation/ActionSubmissionIssue.ts"
import type { EffectJson } from "#lib/rules-engine/turn-resolution/effects/EffectJson.ts"
import type { ResolvePhaseError } from "#lib/rules-engine/turn-resolution/phases/ResolvePhaseError.ts"

export type ResolveTurnError = InvalidSubmissions | FailedToResolvePhases | UnresolvedEffects
type InvalidSubmissions = Readonly<{ _tag: "INVALID_SUBMISSIONS"; issues: ActionSubmissionIssue[] }>
type FailedToResolvePhases = Readonly<{ _tag: "FAILED_TO_RESOLVE_PHASES"; error: ResolvePhaseError }>
type UnresolvedEffects = Readonly<{ _tag: "UNRESOLVED_EFFECTS"; effects: EffectJson[] }>

export const ResolveTurnError = {
  InvalidSubmissions: ({ issues }: Omit<InvalidSubmissions, "_tag">): InvalidSubmissions => {
    return {
      _tag: "INVALID_SUBMISSIONS",
      issues,
    }
  },
  FailedToResolvePhases: ({ error }: Omit<FailedToResolvePhases, "_tag">): FailedToResolvePhases => {
    return {
      _tag: "FAILED_TO_RESOLVE_PHASES",
      error,
    }
  },
  UnresolvedEffects: ({ effects }: Omit<UnresolvedEffects, "_tag">): UnresolvedEffects => {
    return {
      _tag: "UNRESOLVED_EFFECTS",
      effects,
    }
  },
}
