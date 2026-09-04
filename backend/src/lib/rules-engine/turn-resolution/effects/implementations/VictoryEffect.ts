import { Result } from "@guillaume-docquier/tools-ts"
import { PlayerId } from "#lib/db/players/PlayerId.ts"
import type { SubmittedAction } from "#lib/rules-engine/action-submission/Action.ts"
import type { VictoryMechanic } from "#lib/rules-engine/ruleset-model/mechanics/implementations/VictoryMechanic.ts"
import { Effect } from "#lib/rules-engine/turn-resolution/effects/Effect.ts"
import type { EffectError } from "#lib/rules-engine/turn-resolution/effects/EffectError.ts"
import { EffectOutcome } from "#lib/rules-engine/turn-resolution/effects/EffectOutcome.ts"
import type { TurnContext } from "#lib/rules-engine/turn-resolution/TurnContext.ts"

export class VictoryEffect extends Effect {
  private readonly targetPlayerId: string

  public constructor(id: number, mechanic: VictoryMechanic, submittedAction: SubmittedAction) {
    super(id, mechanic.type, submittedAction)
    this.targetPlayerId = submittedAction.targets[mechanic.targets.player.tag]
  }

  protected override doResolve(context: TurnContext): Result<EffectOutcome, EffectError> {
    if (context.turnState.winnerPlayerId !== undefined) {
      return Result.Success(
        EffectOutcome.Prevented({ reason: `Another player "${context.turnState.winnerPlayerId}" already won the game` }),
      )
    }

    context.turnState.winnerPlayerId = PlayerId.parse(this.targetPlayerId)
    return Result.Success(EffectOutcome.Resolved({ result: `Player "${context.turnState.winnerPlayerId}" wins the game` }))
  }
}
