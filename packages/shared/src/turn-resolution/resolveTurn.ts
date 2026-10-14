import { Result, type Rng } from "@guillaume-docquier/tools-ts"
import { validateSubmittedActions } from "#shared/action-submission/validation/validateSubmittedActions.ts"
import { compareOrdinalStrings } from "#shared/domain/compareOrdinalStrings.ts"
import type { Ruleset } from "#shared/domain/ruleset/Ruleset.ts"
import type { Effect } from "#shared/turn-resolution/effects/Effect.ts"
import { EffectFactory } from "#shared/turn-resolution/effects/EffectFactory.ts"
import { EffectPool } from "#shared/turn-resolution/effects/EffectPool.ts"
import { MonotonicIdFactory } from "#shared/turn-resolution/MonotonicIdFactory.ts"
import { resolvePhases } from "#shared/turn-resolution/phases/resolvePhases.ts"
import type { ResolvedTurnState } from "#shared/turn-resolution/ResolvedTurnState.ts"
import { ResolveTurnError } from "#shared/turn-resolution/ResolveTurnError.ts"
import type { TurnContext } from "#shared/turn-resolution/TurnContext.ts"
import type { TurnState } from "#shared/turn-resolution/TurnState.ts"
import { validateLoadedFleetCombatState } from "./validateLoadedFleetCombatState.ts"

/**
 * Takes a turn state and applies all its actions on it, then returns it.
 * The turnState will be mutated. You should not provide an object that cannot / must not be mutated.
 */
export function resolveTurn(turnState: TurnState, ruleset: Ruleset, rng: Rng): Result<ResolvedTurnState, ResolveTurnError> {
  const loadedFleetStateError = validateLoadedFleetCombatState(turnState, ruleset)
  if (loadedFleetStateError !== undefined) {
    return Result.Failure(ResolveTurnError.InvalidTurnState({ error: loadedFleetStateError }))
  }

  const context: TurnContext = {
    rng,
    turnState,
    effectPool: new EffectPool([]),
    ruleset,
    previousJourneyFleetIds: Object.values(turnState.fleets)
      .filter((fleet) => fleet.movement !== undefined)
      .map(({ id }) => id)
      .toSorted((first, second) => compareOrdinalStrings(first, second)),
    newDepartureFleetIds: new Set(),
    removedFleetIds: new Set(),
    changedPlanetIds: new Set(),
    resolvedContinuations: [],
    pendingArrivalAssaults: [],
    pendingArrivalColonizations: [],
    fleetIdRebindings: new Map(),
  }
  const submittedActions = turnState.submittedActions

  // Validate submissions
  const submittedActionIssues = validateSubmittedActions(submittedActions, ruleset, turnState)
  if (submittedActionIssues.length > 0) {
    return Result.Failure(ResolveTurnError.InvalidSubmissions({ issues: submittedActionIssues }))
  }

  // Create effects
  const effects = createTurnEffects(submittedActions, ruleset)
  if (Result.isFailure(effects)) return effects
  context.effectPool.addMany(effects.value)

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
    resolvedContinuations: context.resolvedContinuations,
    removedFleetIds: [...context.removedFleetIds].toSorted((first, second) => compareOrdinalStrings(first, second)),
    planetOwnershipChanges: [...context.changedPlanetIds]
      .toSorted((first, second) => compareOrdinalStrings(first, second))
      .flatMap((planetId) => {
        const planet = context.turnState.planets[planetId]
        return planet?.ownerPlayerId === null || planet === undefined ? [] : [{ planetId, ownerPlayerId: planet.ownerPlayerId }]
      }),
  })
}
function createTurnEffects(submittedActions: TurnState["submittedActions"], ruleset: Ruleset): Result<Effect[], ResolveTurnError> {
  const monotonicIdFactory = MonotonicIdFactory.create()
  const createdEffects: Effect[] = []
  const canonicalSubmissions = [...submittedActions].toSorted((first, second) => {
    const playerOrder = compareOrdinalStrings(first.playerId, second.playerId)
    return playerOrder !== 0 ? playerOrder : compareOrdinalStrings(first.id, second.id)
  })
  for (const submittedAction of canonicalSubmissions) {
    const effectCreationResult = EffectFactory.fromSubmittedAction(submittedAction, ruleset, monotonicIdFactory)
    if (Result.isFailure(effectCreationResult)) {
      return Result.Failure(ResolveTurnError.FailedToCreateEffects({ error: effectCreationResult.error }))
    }
    createdEffects.push(...effectCreationResult.value)
  }
  return Result.Success(createdEffects)
}
