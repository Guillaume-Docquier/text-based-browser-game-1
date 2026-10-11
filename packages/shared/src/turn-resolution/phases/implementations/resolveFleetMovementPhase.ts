import { Result } from "@guillaume-docquier/tools-ts"
import { safeTypedParse, NonNegativeNumberSchema } from "@guillaume-docquier/tools-ts/schemas"
import { ActionDefinitionSchema } from "#shared/domain/ruleset/action-definitions/ActionDefinition.ts"
import { FleetSchema } from "#shared/domain/world/fleets/Fleet.ts"
import { getPlanetDistance } from "#shared/domain/world/planets/getPlanetDistance.ts"
import { EffectError } from "#shared/turn-resolution/effects/EffectError.ts"
import { getDepartureFleetId } from "#shared/turn-resolution/effects/implementations/FleetMoveEffect.ts"
import { ResolvePhaseError } from "#shared/turn-resolution/phases/ResolvePhaseError.ts"
import type { ResolutionFleet } from "#shared/turn-resolution/state/ResolutionFleet.ts"
import type { TurnContext } from "#shared/turn-resolution/TurnContext.ts"
function fail(error: string): Result<TurnContext, ResolvePhaseError> {
  return Result.Failure(ResolvePhaseError.FailedEffect({ error: EffectError.Failed({ error }) }))
}

function compareJourneys(a: ResolutionFleet, b: ResolutionFleet): number {
  const owner = a.ownerPlayerId.localeCompare(b.ownerPlayerId)
  if (owner !== 0) return owner
  const action = (a.movement?.submittedAction.id ?? "").localeCompare(b.movement?.submittedAction.id ?? "")
  return action !== 0 ? action : a.id.localeCompare(b.id)
}

function exactKeys(actual: object, declared: object): boolean {
  return Object.keys(actual).length === Object.keys(declared).length && Object.keys(declared).every((key) => Object.hasOwn(actual, key))
}

// One canonical progress calculation for both persisted-state integrity and advancement.
function distanceAfterTurns(routeDistance: number, speed: number, completedTurns: number): number {
  return Math.max(0, routeDistance - speed * completedTurns)
}

function validateJourneyProgress(fleet: ResolutionFleet, context: TurnContext): string | undefined {
  const movement = fleet.movement
  if (movement === undefined) return undefined
  const origin = context.turnState.planets[fleet.originPlanetId]
  const destination = fleet.destinationPlanetId === undefined ? undefined : context.turnState.planets[fleet.destinationPlanetId]
  if (origin === undefined || destination === undefined) return "Missing persisted journey planet"
  if (origin.id === destination.id) return "Invalid persisted journey route"
  const completedTurns = context.turnState.turn - movement.initiatingTurn
  if (!Number.isSafeInteger(completedTurns) || completedTurns < 0) return "Invalid journey initiating turn"
  const routeDistance = getPlanetDistance(origin, destination)
  const expectedDistance = distanceAfterTurns(routeDistance, movement.speed, completedTurns)
  if (!Number.isFinite(routeDistance) || fleet.distanceToEnd !== expectedDistance || (completedTurns > 0 && expectedDistance === 0))
    return "Inconsistent persisted journey progress"
  return undefined
}

/** Saved bindings require integrity, not new-submission eligibility against a changed world. */
function validateJourneyBinding(fleet: ResolutionFleet, context: TurnContext): string | undefined {
  const movement = fleet.movement
  if (movement === undefined) return undefined
  const action = movement.submittedAction
  const definition = context.ruleset.actionDefinitions[action.actionDefinitionId]
  if (definition === undefined || !safeTypedParse(ActionDefinitionSchema, definition).success)
    return "Invalid persisted journey Action Definition"
  const pooled = context.ruleset.actionPool.find((entry) => entry.id === action.id)
  if (pooled?.actionDefinitionId !== action.actionDefinitionId) return "Invalid persisted journey Action instance"
  if (context.turnState.players[action.playerId] === undefined) return "Missing persisted journey player"
  const moves = definition.effects.filter((effect) => effect.type === "FLEET_MOVE")
  const move = moves[0]
  if (moves.length !== 1 || move === undefined) return "Persisted journey definition must contain one Move"
  if (!exactKeys(action.selectedTargets, definition.targets) || !exactKeys(action.selectedInputs, definition.inputs))
    return "Invalid persisted journey selection mappings"
  const sourceId = action.selectedTargets[move.targets.fleet.actionTargetTag]
  const destinationId = action.selectedTargets[move.targets.planet.actionTargetTag]
  const selectedStrength = action.selectedInputs[move.inputs.strength.actionInputTag]
  if (
    sourceId === undefined ||
    destinationId !== fleet.destinationPlanetId ||
    selectedStrength === undefined ||
    selectedStrength < fleet.strength
  )
    return "Invalid persisted journey movement binding"
  if (
    movement.initiatingTurn > context.turnState.turn ||
    fleet.id !== getDepartureFleetId(context.turnState.gameId, movement.initiatingTurn, action, sourceId)
  )
    return "Invalid persisted journey departure identity"
  return undefined
}

export function resolveFleetMovementPhase(context: TurnContext): Result<TurnContext, ResolvePhaseError> {
  // Validate saved routes before any departure; zero terminal fleets simply disappear.
  const occupiedInstances = new Set<string>()
  for (const fleet of Object.values(context.turnState.fleets)) {
    if (fleet.strength <= 0) {
      Reflect.deleteProperty(context.turnState.fleets, fleet.id)
      continue
    }
    if (!safeTypedParse(FleetSchema, fleet).success) return fail("Malformed persisted fleet journey")
    const bindingError = validateJourneyBinding(fleet, context)
    if (bindingError !== undefined) return fail(bindingError)
    if (fleet.movement !== undefined) {
      const instance = JSON.stringify([fleet.movement.submittedAction.playerId, fleet.movement.submittedAction.id])
      if (occupiedInstances.has(instance)) return fail("Duplicate persisted journey Action instance")
      occupiedInstances.add(instance)
    }
    const progressError = validateJourneyProgress(fleet, context)
    if (progressError !== undefined) return fail(progressError)
  }
  const effects = context.effectPool
    .getEffectsOfType("FLEET_MOVE")
    .toSorted((a, b) =>
      a.submittedAction.playerId.localeCompare(b.submittedAction.playerId) !== 0
        ? a.submittedAction.playerId.localeCompare(b.submittedAction.playerId)
        : a.submittedAction.id.localeCompare(b.submittedAction.id),
    )
  for (const effect of effects) {
    const result = effect.resolve(context)
    if (Result.isFailure(result)) return Result.Failure(ResolvePhaseError.FailedEffect({ error: result.error }))
  }
  const journeys = Object.values(context.turnState.fleets)
    .filter((fleet) => fleet.movement !== undefined)
    .toSorted((a, b) => compareJourneys(a, b))
  for (const fleet of journeys) {
    const movement = fleet.movement
    const destinationId = fleet.destinationPlanetId
    if (movement === undefined || destinationId === undefined || fleet.distanceToEnd === undefined) return fail("Incomplete journey")
    const origin = context.turnState.planets[fleet.originPlanetId]
    const destination = context.turnState.planets[destinationId]
    if (origin === undefined || destination === undefined) return fail("Missing persisted journey planet")
    const completedTurns = context.turnState.turn - movement.initiatingTurn
    if (!Number.isSafeInteger(completedTurns) || completedTurns < 0) return fail("Invalid journey initiating turn")
    // Derive progress from the route and elapsed turns: repeated subtraction can strand a fleet for an extra turn.
    const routeDistance = getPlanetDistance(origin, destination)
    const distanceBeforeTurn = distanceAfterTurns(routeDistance, movement.speed, completedTurns)
    const distanceMoved = Math.min(movement.speed, distanceBeforeTurn)
    const remaining = safeTypedParse(NonNegativeNumberSchema, distanceAfterTurns(routeDistance, movement.speed, completedTurns + 1))
    if (!remaining.success) return fail("Invalid journey progress")
    fleet.distanceToEnd = remaining.data
    if (fleet.distanceToEnd !== 0) continue
    const tick = safeTypedParse(NonNegativeNumberSchema, Math.ceil((distanceMoved / movement.speed) * 20))
    if (!tick.success) return fail("Invalid arrival tick")
    fleet.arrivedAtTick = tick.data
    fleet.originPlanetId = destinationId
    fleet.destinationPlanetId = undefined
    fleet.distanceToEnd = undefined
    fleet.movement = undefined
    const stationed = Object.values(context.turnState.fleets)
      .filter(
        (candidate) =>
          candidate.id !== fleet.id &&
          candidate.strength > 0 &&
          candidate.ownerPlayerId === fleet.ownerPlayerId &&
          candidate.originPlanetId === destinationId &&
          candidate.destinationPlanetId === undefined,
      )
      .toSorted((a, b) => a.id.localeCompare(b.id))[0]
    if (stationed !== undefined) {
      stationed.strength += fleet.strength
      Reflect.deleteProperty(context.turnState.fleets, fleet.id)
    }
  }
  return Result.Success(context)
}
