import { Assert, Result, type Rng } from "@guillaume-docquier/tools-ts"
import type { ActionSubmissionIssue } from "#lib/rules-engine/action-submission/validation/ActionSubmissionIssue.ts"
import { validateActionSubmissions } from "#lib/rules-engine/action-submission/validation/validateActionSubmissions.ts"
import type { Ruleset } from "#lib/rules-engine/ruleset-model/Ruleset.ts"
import { EffectFactory } from "#lib/rules-engine/turn-resolution/effects/EffectFactory.ts"
import { EffectPool } from "#lib/rules-engine/turn-resolution/effects/EffectPool.ts"
import { resolvePhases } from "#lib/rules-engine/turn-resolution/phases/resolvePhases.ts"
import type { TurnContext } from "#lib/rules-engine/turn-resolution/TurnContext.ts"
import type { TurnState } from "#lib/rules-engine/turn-resolution/TurnState.ts"

type ResolveTurnError = InvalidSubmissions | FailedEffect
type InvalidSubmissions = { _tag: "INVALID_SUBMISSIONS"; issues: ActionSubmissionIssue[] }
type FailedEffect = { _tag: "FAILED_TO_RESOLVE_EFFECT" }

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
  resolvePhases(context)

  // Check invariants
  Assert.isTrue(context.effects.isEmpty())

  return Result.Success(context.state)
}
