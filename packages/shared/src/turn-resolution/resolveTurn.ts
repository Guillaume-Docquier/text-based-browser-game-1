import { branded, Result, type Rng } from "@guillaume-docquier/tools-ts"
import { validateSubmittedActions } from "#shared/action-submission/validation/validateSubmittedActions.ts"
import { compareOrdinalStrings } from "#shared/domain/compareOrdinalStrings.ts"
import type { PlayerId } from "#shared/domain/players/PlayerId.ts"
import { FleetAssaultEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetAssaultEffectDefinition.ts"
import type { Ruleset } from "#shared/domain/ruleset/Ruleset.ts"
import { isFleetPresentAtPlanet } from "#shared/domain/world/fleets/isFleetPresentAtPlanet.ts"
import type { PlanetId } from "#shared/domain/world/planets/PlanetId.ts"
import type { Effect } from "#shared/turn-resolution/effects/Effect.ts"
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
    resolvedContinuations: [],
    pendingArrivalAssaults: [],
    fleetIdRebindings: new Map(),
  }
  const submittedActions = turnState.submittedActions

  // Validate submissions
  const submittedActionIssues = validateSubmittedActions(submittedActions, ruleset, turnState)
  if (submittedActionIssues.length > 0) {
    return Result.Failure(ResolveTurnError.InvalidSubmissions({ issues: submittedActionIssues }))
  }

  // Create effects
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
  context.effectPool.addMany(createdEffects)

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
  })
}
function validateLoadedFleetCombatState(turnState: TurnState, ruleset: Ruleset): string | undefined {
  const fleets = Object.values(turnState.fleets)
  for (const fleet of fleets.toSorted((first, second) => compareOrdinalStrings(first.id, second.id))) {
    if (!Number.isSafeInteger(fleet.strength) || fleet.strength < 0) {
      return 'Fleet "' + fleet.id + '" has an unsafe Strength value'
    }
  }

  const assaultOwnersByPlanet = new Map<PlanetId, Set<PlayerId>>()
  const addAssaultTarget = (playerId: PlayerId, targetPlanetId: unknown): void => {
    if (typeof targetPlanetId !== "string") {
      return
    }
    const planetId = branded<PlanetId>(targetPlanetId)
    let playerIds = assaultOwnersByPlanet.get(planetId)
    if (playerIds === undefined) {
      playerIds = new Set()
      assaultOwnersByPlanet.set(planetId, playerIds)
    }
    playerIds.add(playerId)
  }

  for (const submittedAction of turnState.submittedActions) {
    if (!Object.hasOwn(ruleset.actionDefinitions, submittedAction.actionDefinitionId)) {
      continue
    }
    const actionDefinition = ruleset.actionDefinitions[submittedAction.actionDefinitionId]
    if (actionDefinition === undefined) {
      continue
    }
    for (const effectDefinition of actionDefinition.effects) {
      if (effectDefinition.type === FleetAssaultEffectDefinition.type) {
        addAssaultTarget(submittedAction.playerId, submittedAction.selectedTargets[effectDefinition.targets.planet.actionTargetTag])
      }
    }
  }

  for (const fleet of fleets) {
    const movement = fleet.movement
    if (movement === undefined) {
      continue
    }
    for (const pendingArrival of movement.pendingArrivalEffects) {
      addAssaultTarget(
        movement.submission.playerId,
        movement.submission.selectedTargets[pendingArrival.effectDefinition.targets.planet.actionTargetTag],
      )
    }
  }

  for (const planetId of [...assaultOwnersByPlanet.keys()].toSorted(compareOrdinalStrings)) {
    const stationaryFleets = fleets.filter((fleet) => isFleetPresentAtPlanet(fleet, planetId))
    const attackingOwners = assaultOwnersByPlanet.get(planetId)
    if (attackingOwners === undefined) {
      continue
    }
    for (const attackingOwnerId of [...attackingOwners].toSorted(compareOrdinalStrings)) {
      const enemyStrength = stationaryFleets
        .filter((fleet) => fleet.ownerPlayerId !== attackingOwnerId)
        .reduce((total, fleet) => total + BigInt(fleet.strength), 0n)
      if (enemyStrength > BigInt(Number.MAX_SAFE_INTEGER)) {
        return (
          'Enemy Strength at Planet "' + planetId + '" exceeds the safe integer range for Assaults by Player "' + attackingOwnerId + '"'
        )
      }
    }
  }
  return undefined
}
