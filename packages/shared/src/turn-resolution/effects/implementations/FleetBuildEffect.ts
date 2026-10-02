import { Assert, branded, Range, Result, type Rng } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { v5 } from "uuid"
import type { SubmittedAction } from "#shared/domain/actions/Action.ts"
import { EffectOutcome } from "#shared/domain/actions/EffectOutcome.ts"
import type { GameId } from "#shared/domain/game/GameId.ts"
import type { PlayerId } from "#shared/domain/players/PlayerId.ts"
import type { FleetBuildEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetBuildEffectDefinition.ts"
import type { FleetId } from "#shared/domain/world/fleets/FleetId.ts"
import { type FleetName, FleetNameSchema } from "#shared/domain/world/fleets/FleetName.ts"
import type { PlanetId } from "#shared/domain/world/planets/PlanetId.ts"
import { Effect } from "#shared/turn-resolution/effects/Effect.ts"
import type { EffectError } from "#shared/turn-resolution/effects/EffectError.ts"
import { resolveTargetId } from "#shared/turn-resolution/effects/resolveTargetId.ts"
import type { ResolutionFleet } from "#shared/turn-resolution/state/ResolutionFleet.ts"
import type { TurnContext } from "#shared/turn-resolution/TurnContext.ts"

export class FleetBuildEffect extends Effect {
  private readonly effectDefinition: FleetBuildEffectDefinition
  private readonly targetPlanetId: PlanetId

  public constructor(id: number, effectDefinition: FleetBuildEffectDefinition, submittedAction: SubmittedAction) {
    super(id, effectDefinition.type, submittedAction)
    this.effectDefinition = effectDefinition
    this.targetPlanetId = resolveTargetId(this.submittedAction.selectedTargets, this.effectDefinition.targets.planet)
  }

  protected override doResolve(context: TurnContext): Result<EffectOutcome[], EffectError> {
    // This is O(Fleets), but we expect the number of fleets to stay small, and the number of build effects per turn to also be small.
    // When efficiency becomes a problem, we can reevaluate this.
    // The biggest upside right now is that context.turnState.fleets is the authoritative, always consistent, source of truth for fleets and requires 0 upkeep.
    const existingFleet = Object.values(context.turnState.fleets).find(
      (candidate) =>
        candidate.ownerPlayerId === this.submittedAction.playerId &&
        candidate.originPlanetId === this.targetPlanetId &&
        candidate.destinationPlanetId === undefined,
    )

    if (existingFleet === undefined) {
      return Result.Success([this.build(context)])
    } else {
      return Result.Success([this.reinforce(existingFleet)])
    }
  }

  private build(context: TurnContext): EffectOutcome {
    const fleetId = newFleetId({
      gameId: context.turnState.gameId,
      playerId: this.submittedAction.playerId,
      planetId: this.targetPlanetId,
      turn: context.turnState.turn,
    })
    Assert.isNotDefined(context.turnState.fleets[fleetId])

    context.turnState.fleets[fleetId] = {
      id: fleetId,
      ownerPlayerId: this.submittedAction.playerId,
      name: generateFleetName(context.rng),
      strength: this.effectDefinition.parameters.strength,
      originPlanetId: this.targetPlanetId,
    }

    return EffectOutcome.Resolved({
      result: `Player "${this.submittedAction.playerId}" built Fleet "${fleetId}" with strength ${this.effectDefinition.parameters.strength} on Planet "${this.targetPlanetId}"`,
    })
  }

  private reinforce(fleet: ResolutionFleet): EffectOutcome {
    fleet.strength += this.effectDefinition.parameters.strength
    return EffectOutcome.Resolved({
      result: `Player "${this.submittedAction.playerId}" reinforced Fleet "${fleet.id}" by ${this.effectDefinition.parameters.strength} on Planet "${this.targetPlanetId}"`,
    })
  }
}

const FLEET_NAME_NUMBER_RANGE = Range.integer({ min: 999, max: 999999 })

/**
 * This could be improved eventually
 * It should also be extracted out of the effect the day other sources can create fleets so we can share the same logic.
 */
function generateFleetName(rng: Rng): FleetName {
  return typedParse(FleetNameSchema, `fleet ${rng.int(FLEET_NAME_NUMBER_RANGE)}`)
}

/**
 * Creates a deterministic but unique fleet id.
 * It's impossible for a player to create 2 fleets on the same planet in the same turn, because the 2nd build would reinforce the fleet instead of creating a new one.
 * The gameId is important here, because all the fleets will be stored in the DB and fleet id is the PK, so we need to make sure ids will be unique across games too.
 */
function newFleetId({
  gameId,
  playerId,
  planetId,
  turn,
}: {
  gameId: GameId
  playerId: PlayerId
  planetId: PlanetId
  turn: number
}): FleetId {
  return branded<FleetId>(v5(`${gameId}-${playerId}-${planetId}-${turn}`, "429f862a-013d-5dc6-8d9b-f4fe00801af1"))
}
