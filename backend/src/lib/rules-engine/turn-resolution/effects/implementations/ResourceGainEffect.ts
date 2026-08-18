import { Result } from "@guillaume-docquier/tools-ts"
import type { ActionSubmission } from "#lib/rules-engine/action-submission/ActionSubmission.ts"
import type { ResourceGainMechanic } from "#lib/rules-engine/ruleset-model/mechanics/implementations/ResourceGainMechanic.ts"
import { Effect } from "#lib/rules-engine/turn-resolution/effects/Effect.ts"
import { EffectError } from "#lib/rules-engine/turn-resolution/effects/EffectError.ts"
import { EffectOutcome } from "#lib/rules-engine/turn-resolution/effects/EffectOutcome.ts"
import type { TurnContext } from "#lib/rules-engine/turn-resolution/TurnContext.ts"

export class ResourceGainEffect extends Effect {
  private readonly mechanic: ResourceGainMechanic
  private readonly targetPlayerId: string

  public constructor(id: number, mechanic: ResourceGainMechanic, targets: ActionSubmission["targets"]) {
    super(id, mechanic.type)
    this.mechanic = mechanic
    this.targetPlayerId = targets[mechanic.targets.player.tag]
  }

  public override resolve(context: TurnContext): Result<EffectOutcome, EffectError> {
    const player = context.state.players[this.targetPlayerId]
    if (player === undefined) {
      return Result.Failure(EffectError.Failed({ error: `Could not resolve player with id "${this.targetPlayerId}"` }))
    }

    player.resources[this.mechanic.resourceType] += this.mechanic.quantity
    return Result.Success(
      EffectOutcome.Resolved({ result: `Player "${this.targetPlayerId}" gained ${this.mechanic.quantity} ${this.mechanic.resourceType}` }),
    )
  }
}
