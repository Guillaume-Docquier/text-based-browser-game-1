import type { SubmittedActionIssue } from "#shared/action-submission/validation/SubmittedActionIssue.ts"
import type { EffectError } from "#shared/turn-resolution/effects/EffectError.ts"
import type { EffectJson } from "#shared/turn-resolution/effects/EffectJson.ts"
import type { ResolvePhaseError } from "#shared/turn-resolution/phases/ResolvePhaseError.ts"

export type ResolveTurnError = InvalidTurnState | InvalidSubmissions | FailedToCreateEffects | FailedToResolvePhases | UnresolvedEffects
type InvalidTurnState = Readonly<{ type: "INVALID_TURN_STATE"; error: string }>
type InvalidSubmissions = Readonly<{ type: "INVALID_SUBMISSIONS"; issues: SubmittedActionIssue[] }>
type FailedToCreateEffects = Readonly<{ type: "FAILED_TO_CREATE_EFFECTS"; error: EffectError }>
type FailedToResolvePhases = Readonly<{ type: "FAILED_TO_RESOLVE_PHASES"; error: ResolvePhaseError }>
type UnresolvedEffects = Readonly<{ type: "UNRESOLVED_EFFECTS"; effects: EffectJson[] }>

export const ResolveTurnError = {
  InvalidTurnState: ({ error }: Omit<InvalidTurnState, "type">): InvalidTurnState => {
    return {
      type: "INVALID_TURN_STATE",
      error,
    }
  },
  InvalidSubmissions: ({ issues }: Omit<InvalidSubmissions, "type">): InvalidSubmissions => {
    return {
      type: "INVALID_SUBMISSIONS",
      issues,
    }
  },
  FailedToCreateEffects: ({ error }: Omit<FailedToCreateEffects, "type">): FailedToCreateEffects => {
    return {
      type: "FAILED_TO_CREATE_EFFECTS",
      error,
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
