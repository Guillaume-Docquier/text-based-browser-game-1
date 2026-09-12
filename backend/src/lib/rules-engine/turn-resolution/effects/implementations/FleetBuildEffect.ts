import { Assert, branded, Result } from "@guillaume-docquier/tools-ts"
import { v5 } from "uuid"
import type { FleetId } from "#lib/db/fleets/FleetId.ts"
import type { GameId } from "#lib/db/games/GameId.ts"
import type { PlanetId } from "#lib/db/planets/PlanetId.ts"
import type { PlayerId } from "#lib/db/players/PlayerId.ts"
import type { SubmittedAction } from "#lib/rules-engine/action-submission/Action.ts"
import type { FleetBuildMechanic } from "#lib/rules-engine/ruleset-model/mechanics/implementations/FleetBuildMechanic.ts"
import { Effect } from "#lib/rules-engine/turn-resolution/effects/Effect.ts"
import type { EffectError } from "#lib/rules-engine/turn-resolution/effects/EffectError.ts"
import { EffectOutcome } from "#lib/rules-engine/turn-resolution/effects/EffectOutcome.ts"
import { resolveTargetId } from "#lib/rules-engine/turn-resolution/effects/resolveTargetId.ts"
import type { TurnContext } from "#lib/rules-engine/turn-resolution/TurnContext.ts"
import type { Fleet } from "#lib/rules-engine/turn-resolution/TurnState.ts"

export class FleetBuildEffect extends Effect {
  private readonly mechanic: FleetBuildMechanic
  private readonly targetPlanetId: PlanetId

  public constructor(id: number, mechanic: FleetBuildMechanic, submittedAction: SubmittedAction) {
    super(id, mechanic.type, submittedAction)
    this.mechanic = mechanic
    this.targetPlanetId = resolveTargetId(this.submittedAction.selectedTargets, this.mechanic.targets.planet)
  }

  protected override doResolve(context: TurnContext): Result<EffectOutcome, EffectError> {
    const fleet = Object.values(context.turnState.fleets).find(
      (candidate) => candidate.playerId === this.submittedAction.playerId && candidate.originPlanetId === this.targetPlanetId,
    )

    if (fleet !== undefined) {
      return Result.Success(this.reinforce(fleet))
    } else {
      return Result.Success(this.build(context))
    }
  }

  private reinforce(fleet: Fleet): EffectOutcome {
    fleet.strength += this.mechanic.parameters.strength
    return EffectOutcome.Resolved({
      result: `Player "${this.submittedAction.playerId}" reinforced Fleet "${fleet.id}" by ${this.mechanic.parameters.strength} on Planet "${this.targetPlanetId}"`,
    })
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
      playerId: this.submittedAction.playerId,
      strength: this.mechanic.parameters.strength,
      originPlanetId: this.targetPlanetId,
    }

    return EffectOutcome.Resolved({
      result: `Player "${this.submittedAction.playerId}" built Fleet "${fleetId}" with strength ${this.mechanic.parameters.strength} on Planet "${this.targetPlanetId}"`,
    })
  }
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
