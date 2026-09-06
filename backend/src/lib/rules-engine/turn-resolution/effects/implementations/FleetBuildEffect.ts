import { Result } from "@guillaume-docquier/tools-ts"
import { PlanetId, type PlanetId as PlanetIdType } from "#lib/db/planets/PlanetId.ts"
import type { PlayerId } from "#lib/db/players/PlayerId.ts"
import type { SubmittedAction } from "#lib/rules-engine/action-submission/Action.ts"
import type { FleetBuildMechanic } from "#lib/rules-engine/ruleset-model/mechanics/implementations/FleetBuildMechanic.ts"
import { Effect } from "#lib/rules-engine/turn-resolution/effects/Effect.ts"
import { EffectError } from "#lib/rules-engine/turn-resolution/effects/EffectError.ts"
import { EffectOutcome } from "#lib/rules-engine/turn-resolution/effects/EffectOutcome.ts"
import type { FleetIdFactory } from "#lib/rules-engine/turn-resolution/FleetIdFactory.ts"
import type { TurnContext } from "#lib/rules-engine/turn-resolution/TurnContext.ts"

export class FleetBuildEffect extends Effect {
  private readonly mechanic: FleetBuildMechanic
  private readonly targetPlayerId: PlayerId
  private readonly targetPlanetId: PlanetIdType
  private readonly fleetIdFactory: FleetIdFactory

  public constructor(id: number, mechanic: FleetBuildMechanic, submittedAction: SubmittedAction, fleetIdFactory: FleetIdFactory) {
    super(id, mechanic.type, submittedAction)
    this.mechanic = mechanic
    this.targetPlayerId = submittedAction.targets[mechanic.targets.player.tag]
    this.targetPlanetId = PlanetId.parse(Number(submittedAction.targets[mechanic.targets.planet.tag]))
    this.fleetIdFactory = fleetIdFactory
  }

  protected override doResolve(context: TurnContext): Result<EffectOutcome, EffectError> {
    if (context.turnState.players[this.targetPlayerId] === undefined) {
      return Result.Failure(EffectError.Failed({ error: `Could not resolve player with id "${this.targetPlayerId}"` }))
    }

    if (context.turnState.planets[this.targetPlanetId] === undefined) {
      return Result.Failure(EffectError.Failed({ error: `Could not resolve planet with id "${this.targetPlanetId}"` }))
    }

    const existingFleet = Object.values(context.turnState.fleets).find(
      (fleet) => fleet.playerId === this.targetPlayerId && fleet.originPlanetId === this.targetPlanetId,
    )

    if (existingFleet !== undefined) {
      existingFleet.strength += this.mechanic.strength
      return Result.Success(
        EffectOutcome.Resolved({
          result: `Player "${this.targetPlayerId}" added ${this.mechanic.strength} strength to Fleet "${existingFleet.id}"`,
        }),
      )
    }

    const fleet = {
      id: this.fleetIdFactory(),
      playerId: this.targetPlayerId,
      strength: this.mechanic.strength,
      originPlanetId: this.targetPlanetId,
    }
    context.turnState.fleets[fleet.id] = fleet

    return Result.Success(
      EffectOutcome.Resolved({
        result: `Player "${this.targetPlayerId}" built Fleet "${fleet.id}" with ${fleet.strength} strength`,
      }),
    )
  }
}
