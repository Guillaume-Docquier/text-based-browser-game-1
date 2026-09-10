import { Result } from "@guillaume-docquier/tools-ts"
import type { PlayerId } from "#lib/db/players/PlayerId.ts"
import type { SubmittedAction } from "#lib/rules-engine/action-submission/Action.ts"
import type { FleetBuildMechanic } from "#lib/rules-engine/ruleset-model/mechanics/implementations/FleetBuildMechanic.ts"
import { Effect } from "#lib/rules-engine/turn-resolution/effects/Effect.ts"
import { EffectError } from "#lib/rules-engine/turn-resolution/effects/EffectError.ts"
import type { EffectOutcome } from "#lib/rules-engine/turn-resolution/effects/EffectOutcome.ts"
import type { TurnContext } from "#lib/rules-engine/turn-resolution/TurnContext.ts"

export class FleetBuildEffect extends Effect {
  private readonly mechanic: FleetBuildMechanic
  private readonly targetPlayerId: PlayerId
  // private readonly targetPlanetId: PlanetId

  public constructor(id: number, mechanic: FleetBuildMechanic, submittedAction: SubmittedAction) {
    super(id, mechanic.type, submittedAction)
    this.mechanic = mechanic
    this.targetPlayerId = submittedAction.targets[mechanic.targets.player.tag]
    // this.targetPlanetId = branded(submittedAction.targets[mechanic.targets.planet.tag]!)
  }

  protected doResolve(_context: TurnContext): Result<EffectOutcome, EffectError> {
    return Result.Failure(EffectError.Failed({ error: "not yet implemented" }))
  }
}
