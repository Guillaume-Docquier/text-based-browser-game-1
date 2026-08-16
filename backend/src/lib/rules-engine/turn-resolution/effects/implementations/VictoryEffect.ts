import type { ActionSubmission } from "#lib/rules-engine/action-submission/ActionSubmission.ts"
import type { VictoryMechanic } from "#lib/rules-engine/ruleset-model/mechanics/implementations/VictoryMechanic.ts"
import { Effect } from "#lib/rules-engine/turn-resolution/effects/Effect.ts"
import type { TurnContext } from "#lib/rules-engine/turn-resolution/TurnContext.ts"

export class VictoryEffect extends Effect {
  private readonly targetPlayerId: string

  public constructor(id: number, mechanic: VictoryMechanic, targets: ActionSubmission["targets"]) {
    super(id, mechanic.type)
    this.targetPlayerId = targets[mechanic.targets.player.tag]
  }

  protected override doResolve(context: TurnContext): void {
    if (context.state.winnerPlayerId !== undefined) {
      return
    }

    context.state.winnerPlayerId = this.targetPlayerId
  }
}
