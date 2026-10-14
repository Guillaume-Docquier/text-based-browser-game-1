import { Result } from "@guillaume-docquier/tools-ts"
import { NonNegativeNumberSchema, safeTypedParse, typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { v5 } from "uuid"
import { type NonNegativeSafeInteger, NonNegativeSafeIntegerSchema } from "#shared/domain/NonNegativeSafeInteger.ts"
import { PositiveIntegerSchema } from "#shared/domain/ruleset/action-definitions/PositiveInteger.ts"
import type { FleetMoveEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetMoveEffectDefinition.ts"
import type { SubmittedAction } from "#shared/domain/turns/actions/Action.ts"
import { EffectOutcome } from "#shared/domain/turns/actions/EffectOutcome.ts"
import type { PendingArrivalEffect } from "#shared/domain/world/fleets/Fleet.ts"
import { FleetIdSchema, type FleetId } from "#shared/domain/world/fleets/FleetId.ts"
import type { PlanetId } from "#shared/domain/world/planets/PlanetId.ts"
import { Effect } from "#shared/turn-resolution/effects/Effect.ts"
import { EffectError } from "#shared/turn-resolution/effects/EffectError.ts"
import { resolveTargetId } from "#shared/turn-resolution/effects/resolveTargetId.ts"
import type { ResolutionFleet } from "#shared/turn-resolution/state/ResolutionFleet.ts"
import type { ResolutionPlanet } from "#shared/turn-resolution/state/ResolutionPlanet.ts"
import type { TurnContext } from "#shared/turn-resolution/TurnContext.ts"
import { TurnState } from "#shared/turn-resolution/TurnState.ts"

/** Reserved UUID namespace for deterministic fleet departure identities. */
const FLEET_DEPARTURE_NAMESPACE = "3ac0b19b-e901-4bbf-a1dd-4ed71f73c136"

export class FleetMoveEffect extends Effect {
  private readonly effectDefinition: FleetMoveEffectDefinition
  private readonly targetFleetId: FleetId
  private readonly targetPlanetId: PlanetId
  private readonly pendingArrivalEffects: readonly PendingArrivalEffect[]

  public constructor(
    id: number,
    effectDefinition: FleetMoveEffectDefinition,
    submittedAction: SubmittedAction,
    {
      pendingArrivalEffects = [],
      definitionOrdinal = id,
    }: { pendingArrivalEffects?: readonly PendingArrivalEffect[]; definitionOrdinal?: number } = {},
  ) {
    super(id, effectDefinition.type, submittedAction, definitionOrdinal)
    this.effectDefinition = effectDefinition
    this.targetFleetId = resolveTargetId(this.submittedAction.selectedTargets, this.effectDefinition.targets.fleet)
    this.targetPlanetId = resolveTargetId(this.submittedAction.selectedTargets, this.effectDefinition.targets.planet)
    this.pendingArrivalEffects = pendingArrivalEffects
  }

  protected override doResolve(context: TurnContext): Result<EffectOutcome[], EffectError> {
    const fleet = TurnState.getFleet(context.turnState, this.targetFleetId)
    if (fleet === undefined) {
      return Result.Failure(EffectError.Failed({ error: `Source Fleet "${this.targetFleetId}" could not be found` }))
    }
    const originPlanet = TurnState.getPlanet(context.turnState, fleet.originPlanetId)
    if (originPlanet === undefined) {
      return Result.Failure(EffectError.Failed({ error: `Origin Planet "${fleet.originPlanetId}" could not be found` }))
    }
    const destinationPlanet = TurnState.getPlanet(context.turnState, this.targetPlanetId)
    if (destinationPlanet === undefined) {
      return Result.Failure(EffectError.Failed({ error: `Destination Planet "${this.targetPlanetId}" could not be found` }))
    }

    const strengthResult = this.selectedStrength(fleet)
    if (Result.isFailure(strengthResult)) {
      return strengthResult
    }
    const strength = strengthResult.value
    if (!this.isOwnedStationarySource(fleet)) {
      return Result.Failure(EffectError.Failed({ error: `Fleet "${fleet.id}" is not an owned stationary source` }))
    }
    const departureId = typedParse(
      FleetIdSchema,
      v5(
        JSON.stringify([
          context.turnState.gameId,
          this.submittedAction.playerId,
          context.turnState.turn,
          this.submittedAction.id,
          fleet.id,
        ]),
        FLEET_DEPARTURE_NAMESPACE,
      ),
    )
    if (context.turnState.fleets[departureId] !== undefined) {
      return Result.Failure(EffectError.Failed({ error: `Deterministic departure Fleet "${departureId}" already exists` }))
    }

    this.depart(context, { fleet, strength, departureId, originPlanet, destinationPlanet })
    return Result.Success([
      EffectOutcome.Resolved({
        result: `Fleet "${fleet.name}" sent ${strength} Strength from Planet "${originPlanet.name}" towards Planet "${destinationPlanet.name}"`,
      }),
    ])
  }
  private depart(
    context: TurnContext,
    {
      fleet,
      strength,
      departureId,
      originPlanet,
      destinationPlanet,
    }: {
      fleet: ResolutionFleet
      strength: NonNegativeSafeInteger
      departureId: FleetId
      originPlanet: ResolutionPlanet
      destinationPlanet: ResolutionPlanet
    },
  ): void {
    const remainingStrength = typedParse(NonNegativeSafeIntegerSchema, fleet.strength - strength)
    if (remainingStrength === 0) {
      TurnState.removeFleet(context.turnState, fleet.id)
      context.removedFleetIds.add(fleet.id)
    } else {
      fleet.strength = remainingStrength
    }

    const distance = typedParse(
      NonNegativeNumberSchema,
      Math.hypot(destinationPlanet.x - originPlanet.x, destinationPlanet.y - originPlanet.y),
    )
    const departureFleet = {
      id: departureId,
      ownerPlayerId: fleet.ownerPlayerId,
      name: fleet.name,
      strength,
      originPlanetId: fleet.originPlanetId,
      destinationPlanetId: destinationPlanet.id,
      distanceToEnd: distance,
      movement: {
        speed: this.effectDefinition.parameters.speed,
        departureTurn: typedParse(PositiveIntegerSchema, context.turnState.turn),
        submission: this.submittedAction,
        pendingArrivalEffects: this.pendingArrivalEffects,
      },
    }
    context.turnState.fleets[departureId] = departureFleet
    context.newDepartureFleetIds.add(departureId)
  }
  private selectedStrength(fleet: ResolutionFleet): Result<NonNegativeSafeInteger, EffectError> {
    const selectedStrengthInput = this.submittedAction.selectedInputs[this.effectDefinition.inputs.strength.actionInputTag]
    if (selectedStrengthInput === undefined) {
      return Result.Failure(EffectError.Failed({ error: `Fleet "${fleet.id}" cannot supply the selected movement Strength` }))
    }
    const selectedStrength = safeTypedParse(PositiveIntegerSchema, selectedStrengthInput)
    if (!selectedStrength.success || selectedStrength.data > Number(fleet.strength)) {
      return Result.Failure(EffectError.Failed({ error: `Fleet "${fleet.id}" cannot supply the selected movement Strength` }))
    }
    const strength = typedParse(NonNegativeSafeIntegerSchema, selectedStrength.data)
    return Result.Success(strength)
  }
  private isOwnedStationarySource(fleet: ResolutionFleet): boolean {
    return (
      fleet.ownerPlayerId === this.submittedAction.playerId &&
      fleet.movement === undefined &&
      fleet.destinationPlanetId === undefined &&
      fleet.distanceToEnd === undefined
    )
  }
}
