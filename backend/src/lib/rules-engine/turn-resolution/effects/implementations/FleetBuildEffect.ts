import { branded, Result } from "@guillaume-docquier/tools-ts"
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
import type { TurnContext } from "#lib/rules-engine/turn-resolution/TurnContext.ts"
import type { Fleet } from "#lib/rules-engine/turn-resolution/TurnState.ts"

export class FleetBuildEffect extends Effect {
  private readonly mechanic: FleetBuildMechanic
  private readonly targetPlanetId: PlanetId

  public constructor(id: number, mechanic: FleetBuildMechanic, submittedAction: SubmittedAction) {
    super(id, mechanic.type, submittedAction)
    this.mechanic = mechanic
    this.targetPlanetId = branded<PlanetId>(Number(this.submittedAction.targets[this.mechanic.targets.planet.tag]))
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
    const fleetId = newFleetId({ gameId: context.gameId, playerId: this.submittedAction.playerId, planetId: this.targetPlanetId })
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

function newFleetId({ gameId, playerId, planetId }: { gameId: GameId; playerId: PlayerId; planetId: PlanetId }): FleetId {
  return branded<FleetId>(v5(`${gameId}-${playerId}-${planetId}`, "429f862a-013d-5dc6-8d9b-f4fe00801af1"))
}
