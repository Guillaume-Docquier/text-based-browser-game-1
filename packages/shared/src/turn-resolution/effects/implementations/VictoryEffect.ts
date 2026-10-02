import { Result } from "@guillaume-docquier/tools-ts"
import type { SubmittedAction } from "#shared/domain/actions/Action.ts"
import { EffectOutcome } from "#shared/domain/actions/EffectOutcome.ts"
import type { VictoryEffectDefinition } from "#shared/domain/ruleset/effect-definitions/VictoryEffectDefinition.ts"
import { Effect } from "#shared/turn-resolution/effects/Effect.ts"
import type { EffectError } from "#shared/turn-resolution/effects/EffectError.ts"
import type { TurnContext } from "#shared/turn-resolution/TurnContext.ts"

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
