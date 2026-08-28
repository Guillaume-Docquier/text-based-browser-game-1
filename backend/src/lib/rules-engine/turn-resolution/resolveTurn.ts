import { Result, type Rng } from "@guillaume-docquier/tools-ts"
import { validateSubmittedActions } from "#lib/rules-engine/action-submission/validation/validateSubmittedActions.ts"
import type { Ruleset } from "#lib/rules-engine/ruleset-model/Ruleset.ts"
import { EffectFactory } from "#lib/rules-engine/turn-resolution/effects/EffectFactory.ts"
import { EffectPool } from "#lib/rules-engine/turn-resolution/effects/EffectPool.ts"
import { MonotonicIdFactory } from "#lib/rules-engine/turn-resolution/MonotonicIdFactory.ts"
import { resolvePhases } from "#lib/rules-engine/turn-resolution/phases/resolvePhases.ts"
import type { ResolvedTurnState } from "#lib/rules-engine/turn-resolution/ResolvedTurnState.ts"
import { ResolveTurnError } from "#lib/rules-engine/turn-resolution/ResolveTurnError.ts"
import type { TurnContext } from "#lib/rules-engine/turn-resolution/TurnContext.ts"
import type { TurnState } from "#lib/rules-engine/turn-resolution/TurnState.ts"

/**
 * Takes a turn state and applies all its actions on it, then returns it.
 * The turnState will be mutated. You should not provide an object that cannot / must not be mutated.
 */
export function resolveTurn(turnState: TurnState, ruleset: Ruleset, rng: Rng): Result<ResolvedTurnState, ResolveTurnError> {
  const context: TurnContext = {
    rng,
    turnState,
    effectPool: new EffectPool([]),
    ruleset,
  }
  const submittedActions = turnState.submittedActions

  // Validate submissions
  const submittedActionIssues = validateSubmittedActions(submittedActions, ruleset, turnState)
  if (submittedActionIssues.length > 0) {
    return Result.Failure(ResolveTurnError.InvalidSubmissions({ issues: submittedActionIssues }))
  }

  // Create effects
  const monotonicIdFactory = MonotonicIdFactory.create()
  context.effectPool.addMany(
    submittedActions.flatMap((submittedAction) => EffectFactory.fromSubmittedAction(submittedAction, ruleset, monotonicIdFactory)),
  )

  // Resolve effects
  const phaseResolutionResult = resolvePhases(context)
  if (Result.isFailure(phaseResolutionResult)) {
    return Result.Failure(ResolveTurnError.FailedToResolvePhases({ error: phaseResolutionResult.error }))
  }

  // Check invariants
  if (!context.effectPool.isEmpty()) {
    return Result.Failure(ResolveTurnError.UnresolvedEffects({ effects: context.effectPool.getAll().map((effect) => effect.toJson()) }))
  }

  return Result.Success({
    resolvedActions: context.turnState.submittedActions.map((submittedAction) => ({
      submittedAction,
      actionOutcomes: context.effectPool.getOutcomes(submittedAction),
    })),
    players: context.turnState.players,
    winnerPlayerId: context.turnState.winnerPlayerId,
  })
}
