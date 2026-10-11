import { Result, type Rng } from "@guillaume-docquier/tools-ts"
import { validateSubmittedActions } from "#shared/action-submission/validation/validateSubmittedActions.ts"
import type { Ruleset } from "#shared/domain/ruleset/Ruleset.ts"
import { compareOrigins, actionOriginKey } from "#shared/domain/turns/actions/ActionResolutionOrigin.ts"
import { EffectFactory } from "#shared/turn-resolution/effects/EffectFactory.ts"
import { EffectPool } from "#shared/turn-resolution/effects/EffectPool.ts"
import { MonotonicIdFactory } from "#shared/turn-resolution/MonotonicIdFactory.ts"
import { validateSavedFleets } from "#shared/turn-resolution/phases/implementations/resolveFleetMovementPhase.ts"
import { ResolvePhaseError } from "#shared/turn-resolution/phases/ResolvePhaseError.ts"
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
    arrivalIntents: [],
    destroyedFleetIds: new Set(),
    rng,
    turnState,
    effectPool: new EffectPool([]),
    ruleset,
  }
  const submittedActions = turnState.submittedActions

  // Eligibility reads saved journey bindings, so establish their integrity first.
  const savedValidation = validateSavedFleets(context)
  if (Result.isFailure(savedValidation)) return Result.Failure(ResolveTurnError.FailedToResolvePhases({ error: savedValidation.error }))

  // Validate submissions
  const submittedActionIssues = validateSubmittedActions(submittedActions, ruleset, turnState)
  if (submittedActionIssues.length > 0) {
    return Result.Failure(ResolveTurnError.InvalidSubmissions({ issues: submittedActionIssues }))
  }

  // Create effects
  const creation = createSubmittedEffects(context)
  if (Result.isFailure(creation)) return creation

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
    resolvedActions: projectResolvedActions(context),
    players: context.turnState.players,
    planets: context.turnState.planets,
    fleets: context.turnState.fleets,
    winnerPlayerId: context.turnState.winnerPlayerId,
  })
}

function createSubmittedEffects(context: TurnContext): Result<void, ResolveTurnError> {
  const monotonicIdFactory = MonotonicIdFactory.create()
  for (const submittedAction of context.turnState.submittedActions) {
    const created = EffectFactory.fromSubmittedAction(submittedAction, context.ruleset, monotonicIdFactory)
    if (Result.isFailure(created))
      return Result.Failure(ResolveTurnError.FailedToResolvePhases({ error: ResolvePhaseError.FailedEffect({ error: created.error }) }))
    for (const effect of created.value) effect.origin = { initiatingTurn: context.turnState.turn, submittedAction }
    context.effectPool.addMany(created.value)
  }
  return Result.Success(undefined)
}

function projectResolvedActions(context: TurnContext): ResolvedTurnState["resolvedActions"] {
  const origins = new Map(context.effectPool.getOrigins().map((origin) => [actionOriginKey(origin), origin]))
  for (const submittedAction of context.turnState.submittedActions) {
    const origin = { initiatingTurn: context.turnState.turn, submittedAction }
    origins.set(actionOriginKey(origin), origin)
  }
  return Array.from(origins.values())
    .toSorted(compareOrigins)
    .map((origin) => ({
      ...origin,
      actionOutcomes: context.effectPool.getOutcomes(origin.submittedAction, origin.initiatingTurn),
    }))
}
