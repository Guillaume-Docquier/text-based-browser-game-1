import { branded, Result } from "@guillaume-docquier/tools-ts"
import { safeTypedParse, NonNegativeNumberSchema } from "@guillaume-docquier/tools-ts/schemas"
import { v5 } from "uuid"
import type { GameId } from "#shared/domain/games/GameId.ts"
import type { FleetMoveEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetMoveEffectDefinition.ts"
import type { SubmittedAction } from "#shared/domain/turns/actions/Action.ts"
import { EffectOutcome } from "#shared/domain/turns/actions/EffectOutcome.ts"
import type { FleetId } from "#shared/domain/world/fleets/FleetId.ts"
import { getPendingArrivalEffects } from "#shared/domain/world/fleets/PendingArrivalEffect.ts"
import { getPlanetDistance } from "#shared/domain/world/planets/getPlanetDistance.ts"
import type { PlanetId } from "#shared/domain/world/planets/PlanetId.ts"
import { Effect } from "#shared/turn-resolution/effects/Effect.ts"
import { EffectError } from "#shared/turn-resolution/effects/EffectError.ts"
import { generateFleetName } from "#shared/turn-resolution/effects/implementations/FleetBuildEffect.ts"
import type { ResolutionFleet } from "#shared/turn-resolution/state/ResolutionFleet.ts"
import type { TurnContext } from "#shared/turn-resolution/TurnContext.ts"

/** Departure only: the phase materializes all allocations before advancing any journey. */
export class FleetMoveEffect extends Effect {
  private readonly effectDefinition: FleetMoveEffectDefinition
  public constructor(id: number, definition: FleetMoveEffectDefinition, action: SubmittedAction) {
    super(id, definition.type, action)
    this.effectDefinition = definition
  }
  protected override doResolve(context: TurnContext): Result<EffectOutcome[], EffectError> {
    const departure = validateDeparture(context, this.submittedAction, this.effectDefinition)
    if (Result.isFailure(departure)) return departure
    if (departure.value === undefined) return Result.Success([EffectOutcome.Prevented({ reason: "Source fleet no longer exists" })])
    const { source, destination, strength } = departure.value
    const construction = constructDeparture(context, this.submittedAction, this.effectDefinition, departure.value)
    if (Result.isFailure(construction)) return construction
    const child = construction.value
    const id = child.id
    source.strength -= strength
    if (source.strength === 0) Reflect.deleteProperty(context.turnState.fleets, source.id)
    context.turnState.fleets[id] = child
    return Result.Success([
      EffectOutcome.Resolved({ result: `Fleet "${child.name}" departed with ${strength} strength towards Planet "${destination.name}"` }),
    ])
  }
}

/** Stable identity also binds a persisted child to its initiating submission without retaining the source fleet. */
export function getDepartureFleetId(gameId: GameId, initiatingTurn: number, action: SubmittedAction, sourceId: string): FleetId {
  return branded<FleetId>(
    v5(JSON.stringify([gameId, action.playerId, initiatingTurn, action.id, sourceId]), "5080712c-7db6-51ab-9ec9-874198c071bb"),
  )
}

type Departure = Readonly<{
  sourceId: string
  source: ResolutionFleet
  destination: TurnContext["turnState"]["planets"][PlanetId]
  origin: TurnContext["turnState"]["planets"][PlanetId]
  strength: number
}>

function validateDeparture(
  context: TurnContext,
  action: SubmittedAction,
  definition: FleetMoveEffectDefinition,
): Result<Departure | undefined, EffectError> {
  const sourceId = action.selectedTargets[definition.targets.fleet.actionTargetTag]
  const destinationId = action.selectedTargets[definition.targets.planet.actionTargetTag]
  if (sourceId === undefined || destinationId === undefined)
    return Result.Failure(EffectError.Failed({ error: "Missing movement targets" }))
  const source = context.turnState.fleets[branded<FleetId>(sourceId)]
  const destination = context.turnState.planets[branded<PlanetId>(destinationId)]
  const origin = source === undefined ? undefined : context.turnState.planets[source.originPlanetId]
  const strength = action.selectedInputs[definition.inputs.strength.actionInputTag]
  if (source === undefined || source.strength <= 0) return Result.Success(undefined)
  const selection = { source, origin, destination, strength }
  if (!isValidDepartureSelection(selection, action))
    return Result.Failure(EffectError.Failed({ error: "Invalid movement departure context" }))
  return Result.Success({ sourceId, ...selection })
}

function constructDeparture(
  context: TurnContext,
  action: SubmittedAction,
  definition: FleetMoveEffectDefinition,
  { sourceId, source, destination, origin, strength }: Departure,
): Result<ResolutionFleet, EffectError> {
  const id = getDepartureFleetId(context.turnState.gameId, context.turnState.turn, action, sourceId)
  if (context.turnState.fleets[id] !== undefined) return Result.Failure(EffectError.Failed({ error: "Duplicate departure identity" }))
  const distance = safeTypedParse(NonNegativeNumberSchema, getPlanetDistance(origin, destination))
  if (!distance.success) return Result.Failure(EffectError.Failed({ error: "Invalid movement distance" }))
  const pendingArrivalEffects = getPendingArrivalEffects(context.ruleset.actionDefinitions[action.actionDefinitionId]?.effects ?? [])
  const child = {
    id,
    name: generateFleetName(context.rng),
    ownerPlayerId: source.ownerPlayerId,
    strength,
    originPlanetId: source.originPlanetId,
    destinationPlanetId: destination.id,
    distanceToEnd: distance.data,
    movement: {
      type: "FLEET_MOVE" as const,
      initiatingTurn: context.turnState.turn,
      submittedAction: action,
      speed: definition.parameters.speed,
      pendingArrivalEffects,
    },
  }
  return Result.Success(child)
}

type DepartureSelection = Readonly<{
  source: ResolutionFleet
  origin: Departure["origin"] | undefined
  destination: Departure["destination"] | undefined
  strength: number | undefined
}>
function isValidDepartureSelection(selection: DepartureSelection, action: SubmittedAction): selection is Omit<Departure, "sourceId"> {
  if (selection.origin === undefined || selection.destination === undefined) return false
  if (selection.strength === undefined) return false
  if (selection.source.destinationPlanetId !== undefined) return false
  if (selection.source.ownerPlayerId !== action.playerId) return false
  return !(selection.strength > selection.source.strength)
}
