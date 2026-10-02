import { Result } from "@guillaume-docquier/tools-ts"
import { NonNegativeNumberSchema, typedParse } from "@guillaume-docquier/tools-ts/schemas"
import type { SubmittedAction } from "#shared/domain/actions/Action.ts"
import { EffectOutcome } from "#shared/domain/actions/EffectOutcome.ts"
import type { FleetMoveEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetMoveEffectDefinition.ts"
import type { FleetId } from "#shared/domain/world/fleets/FleetId.ts"
import type { PlanetId } from "#shared/domain/world/planets/PlanetId.ts"
import { Effect } from "#shared/turn-resolution/effects/Effect.ts"
import { EffectError } from "#shared/turn-resolution/effects/EffectError.ts"
import { resolveTargetId } from "#shared/turn-resolution/effects/resolveTargetId.ts"
import type { ResolutionFleet } from "#shared/turn-resolution/state/ResolutionFleet.ts"
import type { ResolutionPlanet } from "#shared/turn-resolution/state/ResolutionPlanet.ts"
import type { TurnContext } from "#shared/turn-resolution/TurnContext.ts"
import { TurnState } from "#shared/turn-resolution/TurnState.ts"

const MOVEMENT_TICKS = 20

export class FleetMoveEffect extends Effect {
  private readonly effectDefinition: FleetMoveEffectDefinition
  private readonly targetFleetId: FleetId
  private readonly targetPlanetId: PlanetId

  public constructor(id: number, effectDefinition: FleetMoveEffectDefinition, submittedAction: SubmittedAction) {
    super(id, effectDefinition.type, submittedAction)
    this.effectDefinition = effectDefinition
    this.targetFleetId = resolveTargetId(this.submittedAction.selectedTargets, this.effectDefinition.targets.fleet)
    this.targetPlanetId = resolveTargetId(this.submittedAction.selectedTargets, this.effectDefinition.targets.planet)
  }

  protected override doResolve(context: TurnContext): Result<EffectOutcome[], EffectError> {
    const entitiesResult = this.getEntities(context)
    if (Result.isFailure(entitiesResult)) {
      return entitiesResult
    }

    const { fleet, originPlanet, destinationPlanet } = entitiesResult.value

    const moveOutcome = this.move({ fleet, originPlanet, destinationPlanet })
    if (fleet.arrivedAtTick === undefined) {
      return Result.Success([moveOutcome])
    }

    // This is O(Fleets), but we expect the number of fleets to stay small, and the number of build effects per turn to also be small.
    // When efficiency becomes a problem, we can reevaluate this.
    // The biggest upside right now is that context.turnState.fleets is the authoritative, always consistent, source of truth for fleets and requires 0 upkeep.
    const fleetAtDestination = Object.values(context.turnState.fleets).find(
      (candidate) =>
        candidate.id !== fleet.id &&
        candidate.ownerPlayerId === this.submittedAction.playerId &&
        candidate.originPlanetId === this.targetPlanetId &&
        candidate.destinationPlanetId === undefined,
    )

    if (fleetAtDestination === undefined) {
      return Result.Success([moveOutcome, this.land({ fleet, destinationPlanet })])
    } else {
      return Result.Success([moveOutcome, this.merge({ fleet, fleetAtDestination, destinationPlanet })])
    }
  }

  /**
   * Gets the entities this effect needs to work with.
   * Returns an error if it fails to find the required entities.
   */
  private getEntities(
    context: TurnContext,
  ): Result<{ fleet: ResolutionFleet; originPlanet: ResolutionPlanet; destinationPlanet: ResolutionPlanet }, EffectError> {
    const fleet = TurnState.getFleet(context.turnState, this.targetFleetId)
    if (fleet === undefined) {
      return Result.Failure(EffectError.Failed({ error: "Target fleet could not be found." }))
    }

    const originPlanet = TurnState.getPlanet(context.turnState, fleet.originPlanetId)
    if (originPlanet === undefined) {
      return Result.Failure(EffectError.Failed({ error: "Origin planet could not be found." }))
    }

    const destinationPlanet = TurnState.getPlanet(context.turnState, this.targetPlanetId)
    if (destinationPlanet === undefined) {
      return Result.Failure(EffectError.Failed({ error: "Destination planet could not be found." }))
    }

    return Result.Success({ fleet, originPlanet, destinationPlanet })
  }

  private move({
    fleet,
    originPlanet,
    destinationPlanet,
  }: {
    fleet: ResolutionFleet
    originPlanet: ResolutionPlanet
    destinationPlanet: ResolutionPlanet
  }): EffectOutcome {
    fleet.destinationPlanetId ??= destinationPlanet.id
    fleet.distanceToEnd ??= typedParse(
      NonNegativeNumberSchema,
      Math.hypot(destinationPlanet.x - originPlanet.x, destinationPlanet.y - originPlanet.y),
    )

    const distanceMoved = Math.min(this.effectDefinition.parameters.speed, fleet.distanceToEnd)
    fleet.distanceToEnd = typedParse(NonNegativeNumberSchema, fleet.distanceToEnd - distanceMoved)

    if (fleet.distanceToEnd === 0) {
      fleet.arrivedAtTick = typedParse(
        NonNegativeNumberSchema,
        Math.ceil((distanceMoved / this.effectDefinition.parameters.speed) * MOVEMENT_TICKS),
      )
    }

    return EffectOutcome.Resolved({
      result: `Fleet "${fleet.name}" moved ${distanceMoved} light years towards Planet "${destinationPlanet.name}"`,
    })
  }

  private land({ fleet, destinationPlanet }: { fleet: ResolutionFleet; destinationPlanet: ResolutionPlanet }): EffectOutcome {
    fleet.originPlanetId = destinationPlanet.id
    fleet.destinationPlanetId = undefined
    fleet.distanceToEnd = undefined

    return EffectOutcome.Resolved({
      result: `Fleet "${fleet.name}" arrived on Planet "${destinationPlanet.name}"`,
    })
  }

  private merge({
    fleet,
    fleetAtDestination,
    destinationPlanet,
  }: {
    fleet: ResolutionFleet
    fleetAtDestination: ResolutionFleet
    destinationPlanet: ResolutionPlanet
  }): EffectOutcome {
    const mergedStrength = fleet.strength
    fleetAtDestination.strength += mergedStrength
    fleet.strength = 0

    return EffectOutcome.Resolved({
      result: `Fleet "${fleet.name}" arrived on Planet "${destinationPlanet.name}" and merged ${mergedStrength} strength into Fleet "${fleetAtDestination.name}"`,
    })
  }
}
