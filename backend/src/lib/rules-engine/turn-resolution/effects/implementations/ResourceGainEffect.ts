import { Assert } from "@guillaume-docquier/tools-ts"
import type { ActionSubmission } from "#lib/rules-engine/action-submission/ActionSubmission.ts"
import type { ResourceGainMechanic } from "#lib/rules-engine/ruleset-model/mechanics/implementations/ResourceGainMechanic.ts"
import { Effect } from "#lib/rules-engine/turn-resolution/effects/Effect.ts"
import type { TurnContext } from "#lib/rules-engine/turn-resolution/TurnContext.ts"

export class ResourceGainEffect extends Effect {
  private readonly mechanic: ResourceGainMechanic
  private readonly targetPlayerId: string

  public constructor(mechanic: ResourceGainMechanic, targets: ActionSubmission["targets"]) {
    super(mechanic.type)
    this.mechanic = mechanic
    this.targetPlayerId = targets[mechanic.targets.player.tag]
  }

  protected override doResolve(context: TurnContext): void {
    const player = context.state.players[this.targetPlayerId]
    Assert.isDefined(player)

    player.resources[this.mechanic.resourceType] += this.mechanic.quantity
  }
}
