import { Result } from "@guillaume-docquier/tools-ts"
import type { ActionSubmission } from "#lib/rules-engine/action-submission/ActionSubmission.ts"
import type { VictoryMechanic } from "#lib/rules-engine/ruleset-model/mechanics/implementations/VictoryMechanic.ts"
import { Effect } from "#lib/rules-engine/turn-resolution/effects/Effect.ts"
import type { EffectError } from "#lib/rules-engine/turn-resolution/effects/EffectError.ts"
import { EffectOutcome } from "#lib/rules-engine/turn-resolution/effects/EffectOutcome.ts"
import type { TurnContext } from "#lib/rules-engine/turn-resolution/TurnContext.ts"

export class VictoryEffect extends Effect {
  private readonly targetPlayerId: string

  public constructor(id: number, mechanic: VictoryMechanic, targets: ActionSubmission["targets"]) {
    super(id, mechanic.type)
    this.targetPlayerId = targets[mechanic.targets.player.tag]
  }

  public override resolve(context: TurnContext): Result<EffectOutcome, EffectError> {
    if (context.state.winnerPlayerId !== undefined) {
      return Result.Success(EffectOutcome.Prevented({ reason: `Another player ${context.state.winnerPlayerId} already won the game` }))
    }

    context.state.winnerPlayerId = this.targetPlayerId
    return Result.Success(EffectOutcome.Resolved({ result: `Player ${context.state.winnerPlayerId} wins the game` }))
  }
}
