import { Result } from "@guillaume-docquier/tools-ts"
import type { SubmittedAction } from "#game-rules/action-submission/Action.ts"
import type { VictoryEffectDefinition } from "#game-rules/ruleset/effect-definitions/implementations/VictoryEffectDefinition.ts"
import { Effect } from "#game-rules/turn-resolution/effects/Effect.ts"
import type { EffectError } from "#game-rules/turn-resolution/effects/EffectError.ts"
import { EffectOutcome } from "#game-rules/turn-resolution/effects/EffectOutcome.ts"
import type { TurnContext } from "#game-rules/turn-resolution/TurnContext.ts"

export class VictoryEffect extends Effect {
  public constructor(id: number, effectDefinition: VictoryEffectDefinition, submittedAction: SubmittedAction) {
    super(id, effectDefinition.type, submittedAction)
  }

  protected override doResolve(context: TurnContext): Result<EffectOutcome[], EffectError> {
    if (context.turnState.winnerPlayerId !== undefined) {
      return Result.Success([
        EffectOutcome.Prevented({ reason: `Another player "${context.turnState.winnerPlayerId}" already won the game` }),
      ])
    }

    context.turnState.winnerPlayerId = this.submittedAction.playerId
    return Result.Success([EffectOutcome.Resolved({ result: `Player "${context.turnState.winnerPlayerId}" wins the game` })])
  }
}
