import { branded, Result } from "@guillaume-docquier/tools-ts"
import { safeTypedParse, NonNegativeNumberSchema } from "@guillaume-docquier/tools-ts/schemas"
import { ActionDefinitionSchema, type ActionDefinition } from "#shared/domain/ruleset/action-definitions/ActionDefinition.ts"
import type { SubmittedAction } from "#shared/domain/turns/actions/Action.ts"
import { compareOrigins, compareCodePoints } from "#shared/domain/turns/actions/ActionResolutionOrigin.ts"
import { FleetSchema } from "#shared/domain/world/fleets/Fleet.ts"
import type { FleetId } from "#shared/domain/world/fleets/FleetId.ts"
import { getPendingArrivalEffects, type PendingArrivalEffect } from "#shared/domain/world/fleets/PendingArrivalEffect.ts"
import { getPlanetDistance } from "#shared/domain/world/planets/getPlanetDistance.ts"
import type { PlanetId } from "#shared/domain/world/planets/PlanetId.ts"
import { ArrivalTickSchema, type ArrivalTick } from "#shared/turn-resolution/ArrivalIntent.ts"
import type { Effect } from "#shared/turn-resolution/effects/Effect.ts"
import { EffectError } from "#shared/turn-resolution/effects/EffectError.ts"
import { getDepartureFleetId } from "#shared/turn-resolution/effects/implementations/FleetMoveEffect.ts"
import { ResolvePhaseError } from "#shared/turn-resolution/phases/ResolvePhaseError.ts"
import type { ResolutionFleet } from "#shared/turn-resolution/state/ResolutionFleet.ts"
import type { TurnContext } from "#shared/turn-resolution/TurnContext.ts"
function fail(error: string): Result<TurnContext, ResolvePhaseError> {
  return Result.Failure(ResolvePhaseError.FailedEffect({ error: EffectError.Failed({ error }) }))
}

function compareJourneys(a: ResolutionFleet, b: ResolutionFleet): number {
  if (a.movement === undefined || b.movement === undefined) return compareCodePoints(a.id, b.id)
  const origin = compareOrigins(a.movement, b.movement)
  return origin !== 0 ? origin : compareCodePoints(a.id, b.id)
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
  const route = persistedJourneyRoute(fleet, context)
  if (Result.isFailure(route)) return route.error
  const { origin, destination } = route.value
  const completedTurns = context.turnState.turn - movement.initiatingTurn
  if (!Number.isSafeInteger(completedTurns) || completedTurns < 0) return "Invalid journey initiating turn"
  if (!hasConsistentProgress(fleet, getPlanetDistance(origin, destination), movement.speed, completedTurns))
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
  const identityError = validateSavedInstance(context, action)
  if (identityError !== undefined) return identityError
  const move = savedMoveDefinition(definition, action)
  if (Result.isFailure(move)) return move.error
  const movementError = validateMovementBinding(fleet, context, move.value)
  if (movementError !== undefined) return movementError
  return validatePendingArrivalEffects(fleet, definition)
}

function validateMovementBinding(
  fleet: ResolutionFleet,
  context: TurnContext,
  move: Extract<ActionDefinition["effects"][number], { type: "FLEET_MOVE" }>,
): string | undefined {
  const movement = fleet.movement
  if (movement === undefined) return undefined
  const action = movement.submittedAction
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

function validatePendingArrivalEffects(fleet: ResolutionFleet, definition: ActionDefinition): string | undefined {
  const expectedPending = getPendingArrivalEffects(definition.effects)
  const pending = fleet.movement?.pendingArrivalEffects ?? []
  const indexes = new Set(pending.map((saved) => saved.effectIndex))
  if (
    pending.length !== expectedPending.length ||
    indexes.size !== pending.length ||
    pending.some(
      (saved) =>
        !matchesPendingArrival(
          saved,
          expectedPending.find((entry) => entry.effectIndex === saved.effectIndex),
        ),
    )
  )
    return "Invalid persisted pending arrival effects"
  return undefined
}

type FleetArrival = Readonly<{ fleet: ResolutionFleet; tick: ArrivalTick }>

export function resolveFleetMovementPhase(context: TurnContext): Result<TurnContext, ResolvePhaseError> {
  for (const phase of [recordStationaryColonization, removeTerminalFleets, resolveDepartures]) {
    const result = phase(context)
    if (Result.isFailure(result)) return result
  }
  const arrivals = advanceJourneys(context)
  if (Result.isFailure(arrivals)) return fail(arrivals.error)
  return applyArrivals(context, arrivals.value)
}

function recordStationaryColonization(context: TurnContext): Result<TurnContext, ResolvePhaseError> {
  const stationaryTick = safeTypedParse(ArrivalTickSchema, 0)
  if (!stationaryTick.success) return fail("Invalid stationary arrival tick")
  for (const action of context.turnState.submittedActions) {
    for (const pending of stationaryColonizations(context, action)) {
      const sourceId = action.selectedTargets[pending.definition.targets.fleet.actionTargetTag]
      const planetId = action.selectedTargets[pending.definition.targets.planet.actionTargetTag]
      if (sourceId === undefined || planetId === undefined) return fail("Missing stationary colonization binding")
      context.arrivalIntents.push({
        origin: { initiatingTurn: context.turnState.turn, submittedAction: action },
        departureFleetId: branded<FleetId>(sourceId),
        actualFleetId: branded<FleetId>(sourceId),
        destinationPlanetId: branded<PlanetId>(planetId),
        arrivalTurn: context.turnState.turn,
        tick: stationaryTick.data,
        pending,
      })
    }
  }
  return Result.Success(context)
}

function removeTerminalFleets(context: TurnContext): Result<TurnContext, ResolvePhaseError> {
  for (const fleet of Object.values(context.turnState.fleets)) {
    if (fleet.strength !== 0) continue
    context.destroyedFleetIds.add(fleet.id)
    if (fleet.movement !== undefined && fleet.destinationPlanetId !== undefined) {
      const tick = safeTypedParse(ArrivalTickSchema, 0)
      if (!tick.success) return fail("Invalid terminal arrival tick")
      recordJourneyArrivalIntents(context, { fleet, movement: fleet.movement, destinationId: fleet.destinationPlanetId, tick: tick.data })
    }
    Reflect.deleteProperty(context.turnState.fleets, fleet.id)
  }
  return Result.Success(context)
}

function resolveDepartures(context: TurnContext): Result<TurnContext, ResolvePhaseError> {
  const effects = canonicalDepartures(context)
  for (const effect of effects) {
    const result = effect.resolve(context)
    if (Result.isFailure(result)) return Result.Failure(ResolvePhaseError.FailedEffect({ error: result.error }))
  }
  return Result.Success(context)
}

function advanceJourneys(context: TurnContext): Result<FleetArrival[], string> {
  const journeys = canonicalJourneys(context)
  const arrivals: FleetArrival[] = []
  for (const fleet of journeys) {
    const arrival = advanceJourney(context, fleet)
    if (Result.isFailure(arrival)) return arrival
    if (arrival.value !== undefined) arrivals.push(arrival.value)
  }
  return Result.Success(arrivals)
}

function advanceJourney(context: TurnContext, fleet: ResolutionFleet): Result<FleetArrival | undefined, string> {
  const binding = advancementBinding(context, fleet)
  if (Result.isFailure(binding)) return binding
  const { movement, origin, destination } = binding.value
  const completedTurns = context.turnState.turn - movement.initiatingTurn
  const routeDistance = getPlanetDistance(origin, destination)
  const distanceBeforeTurn = distanceAfterTurns(routeDistance, movement.speed, completedTurns)
  const remaining = safeTypedParse(NonNegativeNumberSchema, distanceAfterTurns(routeDistance, movement.speed, completedTurns + 1))
  if (!remaining.success) return Result.Failure("Invalid journey progress")
  fleet.distanceToEnd = remaining.data
  if (fleet.distanceToEnd !== 0) return Result.Success(undefined)
  const tick = computeArrivalTick(distanceBeforeTurn, movement.speed)
  if (!tick.success) return Result.Failure("Invalid arrival tick")
  return Result.Success({ fleet, tick: tick.data })
}

function applyArrivals(context: TurnContext, arrivals: FleetArrival[]): Result<TurnContext, ResolvePhaseError> {
  arrivals.sort(compareArrivals)
  for (const arrival of arrivals) {
    const result = applyArrival(context, arrival)
    if (Result.isFailure(result)) return result
  }
  return Result.Success(context)
}

function applyArrival(context: TurnContext, { fleet, tick }: FleetArrival): Result<TurnContext, ResolvePhaseError> {
  const movement = fleet.movement
  const destinationId = fleet.destinationPlanetId
  if (movement === undefined || destinationId === undefined) return fail("Incomplete arrival")
  recordJourneyArrivalIntents(context, { fleet, movement, destinationId, tick })
  stationArrivingFleet(fleet, destinationId, tick)
  const stationed = findFriendlyStation(context, fleet, destinationId)
  if (stationed !== undefined) return mergeArrivingFleet(context, fleet, stationed)

  return Result.Success(context)
}

export function validateSavedFleets(context: TurnContext): Result<TurnContext, ResolvePhaseError> {
  // Validate saved routes before any departure; zero terminal fleets simply disappear.
  const occupiedInstances = new Set<string>()
  for (const fleet of Object.values(context.turnState.fleets)) {
    if (!safeTypedParse(FleetSchema, fleet).success) return fail("Malformed persisted fleet journey")
    const bindingError = validateJourneyBinding(fleet, context)
    if (bindingError !== undefined) return fail(bindingError)
    const occupancyError = claimSavedInstance(fleet, occupiedInstances)
    if (occupancyError !== undefined) return fail(occupancyError)
    const progressError = validateJourneyProgress(fleet, context)
    if (progressError !== undefined) return fail(progressError)
  }
  return Result.Success(context)
}

function matchesPendingArrival(saved: PendingArrivalEffect, expected: PendingArrivalEffect | undefined): boolean {
  if (expected === undefined || saved.type !== expected.type) return false
  if (saved.definition.targets.fleet.actionTargetTag !== expected.definition.targets.fleet.actionTargetTag) return false
  if (saved.definition.targets.planet.actionTargetTag !== expected.definition.targets.planet.actionTargetTag) return false
  if (saved.type === "COLONIZE" && expected.type === "COLONIZE")
    return saved.definition.parameters.requiredStrength === expected.definition.parameters.requiredStrength
  return true
}

type JourneyRoute = Readonly<{
  origin: TurnContext["turnState"]["planets"][PlanetId]
  destination: TurnContext["turnState"]["planets"][PlanetId]
}>
function persistedJourneyRoute(fleet: ResolutionFleet, context: TurnContext): Result<JourneyRoute, string> {
  const origin = context.turnState.planets[fleet.originPlanetId]
  const destination = fleet.destinationPlanetId === undefined ? undefined : context.turnState.planets[fleet.destinationPlanetId]
  if (origin === undefined || destination === undefined) return Result.Failure("Missing persisted journey planet")
  if (origin.id === destination.id) return Result.Failure("Invalid persisted journey route")
  return Result.Success({ origin, destination })
}
function hasConsistentProgress(fleet: ResolutionFleet, routeDistance: number, speed: number, completedTurns: number): boolean {
  const expectedDistance = distanceAfterTurns(routeDistance, speed, completedTurns)
  return Number.isFinite(routeDistance) && fleet.distanceToEnd === expectedDistance && !(completedTurns > 0 && expectedDistance === 0)
}

function computeArrivalTick(distanceBeforeTurn: number, speed: number): ReturnType<typeof ArrivalTickSchema.safeParse> {
  // A positive representable distance must never become tick zero through division underflow.
  return safeTypedParse(
    ArrivalTickSchema,
    distanceBeforeTurn === 0 ? 0 : Math.max(1, Math.min(20, Math.ceil((distanceBeforeTurn / speed) * 20))),
  )
}

function findFriendlyStation(context: TurnContext, fleet: ResolutionFleet, destinationId: PlanetId): ResolutionFleet | undefined {
  return Object.values(context.turnState.fleets)
    .filter(
      (candidate) =>
        candidate.id !== fleet.id &&
        candidate.strength > 0 &&
        candidate.ownerPlayerId === fleet.ownerPlayerId &&
        candidate.originPlanetId === destinationId &&
        candidate.destinationPlanetId === undefined,
    )
    .toSorted((a, b) => compareCodePoints(a.id, b.id))[0]
}

function validateSavedInstance(context: TurnContext, action: SubmittedAction): string | undefined {
  const pooled = context.ruleset.actionPool.find((entry) => entry.id === action.id)
  if (pooled?.actionDefinitionId !== action.actionDefinitionId) return "Invalid persisted journey Action instance"
  if (context.turnState.players[action.playerId] === undefined) return "Missing persisted journey player"
  return undefined
}

type MovementDefinition = Extract<ActionDefinition["effects"][number], { type: "FLEET_MOVE" }>
function savedMoveDefinition(definition: ActionDefinition, action: SubmittedAction): Result<MovementDefinition, string> {
  const moves = definition.effects.filter((effect) => effect.type === "FLEET_MOVE")
  const move = moves[0]
  if (moves.length !== 1 || move === undefined) return Result.Failure("Persisted journey definition must contain one Move")
  if (!exactKeys(action.selectedTargets, definition.targets) || !exactKeys(action.selectedInputs, definition.inputs))
    return Result.Failure("Invalid persisted journey selection mappings")
  return Result.Success(move)
}

function stationaryColonizations(
  context: TurnContext,
  action: SubmittedAction,
): Array<Extract<PendingArrivalEffect, { type: "COLONIZE" }>> {
  const definition = context.ruleset.actionDefinitions[action.actionDefinitionId]
  if (definition === undefined) return []
  if (definition.effects.some((effect) => effect.type === "FLEET_MOVE")) return []
  return getPendingArrivalEffects(definition.effects).filter((pending) => pending.type === "COLONIZE")
}

type AdvancementBinding = JourneyRoute & Readonly<{ movement: NonNullable<ResolutionFleet["movement"]> }>
function advancementBinding(context: TurnContext, fleet: ResolutionFleet): Result<AdvancementBinding, string> {
  const movement = fleet.movement
  const destinationId = fleet.destinationPlanetId
  if (movement === undefined || destinationId === undefined || fleet.distanceToEnd === undefined)
    return Result.Failure("Incomplete journey")
  const origin = context.turnState.planets[fleet.originPlanetId]
  const destination = context.turnState.planets[destinationId]
  if (origin === undefined || destination === undefined) return Result.Failure("Missing persisted journey planet")
  return Result.Success({ movement, origin, destination })
}

type JourneyArrival = Readonly<{
  fleet: ResolutionFleet
  movement: NonNullable<ResolutionFleet["movement"]>
  destinationId: PlanetId
  tick: ArrivalTick
}>
function recordJourneyArrivalIntents(context: TurnContext, { fleet, movement, destinationId, tick }: JourneyArrival): void {
  for (const pending of movement.pendingArrivalEffects ?? [])
    context.arrivalIntents.push({
      origin: { initiatingTurn: movement.initiatingTurn, submittedAction: movement.submittedAction },
      departureFleetId: fleet.id,
      actualFleetId: fleet.id,
      destinationPlanetId: destinationId,
      arrivalTurn: context.turnState.turn,
      tick,
      pending,
    })
}

function mergeArrivingFleet(
  context: TurnContext,
  fleet: ResolutionFleet,
  stationed: ResolutionFleet,
): Result<TurnContext, ResolvePhaseError> {
  const strength = stationed.strength + fleet.strength
  if (!Number.isSafeInteger(strength)) return fail("Unsafe merged fleet Strength")
  stationed.strength = strength
  rebindArrivalIntents(context, fleet.id, stationed.id)
  Reflect.deleteProperty(context.turnState.fleets, fleet.id)
  return Result.Success(context)
}
function rebindArrivalIntents(context: TurnContext, previousId: FleetId, survivingId: FleetId): void {
  for (const intent of context.arrivalIntents) if (intent.actualFleetId === previousId) intent.actualFleetId = survivingId
}

function stationArrivingFleet(fleet: ResolutionFleet, destinationId: PlanetId, tick: ArrivalTick): void {
  fleet.arrivedAtTick = tick
  fleet.originPlanetId = destinationId
  fleet.destinationPlanetId = undefined
  fleet.distanceToEnd = undefined
  fleet.movement = undefined
}

function claimSavedInstance(fleet: ResolutionFleet, occupiedInstances: Set<string>): string | undefined {
  if (fleet.movement !== undefined) {
    const instance = JSON.stringify([fleet.movement.submittedAction.playerId, fleet.movement.submittedAction.id])
    if (occupiedInstances.has(instance)) return "Duplicate persisted journey Action instance"
    occupiedInstances.add(instance)
  }
  return undefined
}

function canonicalDepartures(context: TurnContext): Effect[] {
  return context.effectPool
    .getEffectsOfType("FLEET_MOVE")
    .toSorted((a, b) =>
      compareCodePoints(a.submittedAction.playerId, b.submittedAction.playerId) !== 0
        ? compareCodePoints(a.submittedAction.playerId, b.submittedAction.playerId)
        : compareCodePoints(a.submittedAction.id, b.submittedAction.id),
    )
}

function canonicalJourneys(context: TurnContext): ResolutionFleet[] {
  return Object.values(context.turnState.fleets)
    .filter((fleet) => fleet.movement !== undefined)
    .toSorted((a, b) => compareJourneys(a, b))
}

function compareArrivals(a: FleetArrival, b: FleetArrival): number {
  return a.tick !== b.tick ? a.tick - b.tick : compareJourneys(a.fleet, b.fleet)
}
