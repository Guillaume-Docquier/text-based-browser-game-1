import { Result, type Rng } from "@guillaume-docquier/tools-ts"
import { validateSubmittedActions } from "#shared/action-submission/validation/validateSubmittedActions.ts"
import type { Ruleset } from "#shared/domain/ruleset/Ruleset.ts"
import { EffectFactory } from "#shared/turn-resolution/effects/EffectFactory.ts"
import { EffectPool } from "#shared/turn-resolution/effects/EffectPool.ts"
import { MonotonicIdFactory } from "#shared/turn-resolution/MonotonicIdFactory.ts"
import { resolvePhases } from "#shared/turn-resolution/phases/resolvePhases.ts"
import type { ResolvedTurnState } from "#shared/turn-resolution/ResolvedTurnState.ts"
import { ResolveTurnError } from "#shared/turn-resolution/ResolveTurnError.ts"
import type { TurnContext } from "#shared/turn-resolution/TurnContext.ts"
import type { TurnState } from "#shared/turn-resolution/TurnState.ts"

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
    gameId: context.turnState.gameId,
    turn: context.turnState.turn,
    resolvedActions: context.turnState.submittedActions.map((submittedAction) => ({
      submittedAction,
      actionOutcomes: context.effectPool.getOutcomes(submittedAction),
    })),
    players: context.turnState.players,
    planets: context.turnState.planets,
    fleets: context.turnState.fleets,
    winnerPlayerId: context.turnState.winnerPlayerId,
  })
}
