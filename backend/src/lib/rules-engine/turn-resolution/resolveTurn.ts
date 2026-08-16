import { Result, type Rng } from "@guillaume-docquier/tools-ts"
import type { ActionSubmissionIssue } from "#lib/rules-engine/action-submission/validation/ActionSubmissionIssue.ts"
import { validateActionSubmissions } from "#lib/rules-engine/action-submission/validation/validateActionSubmissions.ts"
import type { Ruleset } from "#lib/rules-engine/ruleset-model/Ruleset.ts"
import { EffectFactory } from "#lib/rules-engine/turn-resolution/effects/EffectFactory.ts"
import type { EffectJson } from "#lib/rules-engine/turn-resolution/effects/EffectJson.ts"
import { EffectPool } from "#lib/rules-engine/turn-resolution/effects/EffectPool.ts"
import type { ResolvePhaseError } from "#lib/rules-engine/turn-resolution/phases/ResolvePhaseError.ts"
import { resolvePhases } from "#lib/rules-engine/turn-resolution/phases/resolvePhases.ts"
import type { TurnContext } from "#lib/rules-engine/turn-resolution/TurnContext.ts"
import type { TurnState } from "#lib/rules-engine/turn-resolution/TurnState.ts"

type ResolveTurnError = InvalidSubmissions | FailedToResolvePhases | UnresolvedEffects
type InvalidSubmissions = { _tag: "INVALID_SUBMISSIONS"; issues: ActionSubmissionIssue[] }
type FailedToResolvePhases = { _tag: "FAILED_TO_RESOLVE_PHASES"; error: ResolvePhaseError }
type UnresolvedEffects = { _tag: "UNRESOLVED_EFFECTS"; effects: EffectJson[] }

/**
 * Takes a turn state and applies all its actions on it, then returns it.
 * The turnState is mutated in place. The returned value is the input.
 */
export function resolveTurn(turnState: TurnState, ruleset: Ruleset, rng: Rng): Result<TurnState, ResolveTurnError> {
  const context: TurnContext = {
    rng,
    state: turnState,
    effects: new EffectPool([]),
    ruleset,
  }
  const actionSubmissions = Object.values(turnState.players).flatMap((player) => player.actionSubmissions)

  // Validate submissions
  const actionSubmissionIssues = validateActionSubmissions(actionSubmissions, ruleset, turnState)
  if (actionSubmissionIssues.length > 0) {
    return Result.Failure({ _tag: "INVALID_SUBMISSIONS", issues: actionSubmissionIssues })
  }

  // Create effects
  context.effects.addMany(actionSubmissions.flatMap((actionSubmission) => EffectFactory.fromActionSubmission(actionSubmission, ruleset)))

  // Resolve effects
  const phaseResolutionResult = resolvePhases(context)
  if (Result.isFailure(phaseResolutionResult)) {
    return Result.Failure({ _tag: "FAILED_TO_RESOLVE_PHASES", error: phaseResolutionResult.error })
  }

  // Check invariants
  if (!context.effects.isEmpty()) {
    return Result.Failure({ _tag: "UNRESOLVED_EFFECTS", effects: context.effects.getAll().map((effect) => effect.toJson()) })
  }

  return Result.Success(context.state)
}
