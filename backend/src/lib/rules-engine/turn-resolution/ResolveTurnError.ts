import type { ActionSubmissionIssue } from "#lib/rules-engine/action-submission/validation/ActionSubmissionIssue.ts"
import type { EffectJson } from "#lib/rules-engine/turn-resolution/effects/EffectJson.ts"
import type { ResolvePhaseError } from "#lib/rules-engine/turn-resolution/phases/ResolvePhaseError.ts"

export type ResolveTurnError = InvalidSubmissions | FailedToResolvePhases | UnresolvedEffects
type InvalidSubmissions = Readonly<{ type: "INVALID_SUBMISSIONS"; issues: ActionSubmissionIssue[] }>
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
