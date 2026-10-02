import { Result } from "@guillaume-docquier/tools-ts"
import type { SubmittedAction } from "#shared/domain/actions/Action.ts"
import { EffectOutcome } from "#shared/domain/actions/EffectOutcome.ts"
import type { ResourceGainEffectDefinition } from "#shared/domain/ruleset/effect-definitions/ResourceGainEffectDefinition.ts"
import { Effect } from "#shared/turn-resolution/effects/Effect.ts"
import { EffectError } from "#shared/turn-resolution/effects/EffectError.ts"
import type { TurnContext } from "#shared/turn-resolution/TurnContext.ts"

export class ResourceGainEffect extends Effect {
  private readonly effectDefinition: ResourceGainEffectDefinition

  public constructor(id: number, effectDefinition: ResourceGainEffectDefinition, submittedAction: SubmittedAction) {
    super(id, effectDefinition.type, submittedAction)
    this.effectDefinition = effectDefinition
  }

  protected override doResolve(context: TurnContext): Result<EffectOutcome[], EffectError> {
    const player = context.turnState.players[this.submittedAction.playerId]
    if (player === undefined) {
      return Result.Failure(EffectError.Failed({ error: `Could not resolve player with id "${this.submittedAction.playerId}"` }))
    }

    player.resources[this.effectDefinition.parameters.resourceType] += this.effectDefinition.parameters.quantity
    return Result.Success([
      EffectOutcome.Resolved({
        result: `Player "${this.submittedAction.playerId}" gained ${this.effectDefinition.parameters.quantity} ${this.effectDefinition.parameters.resourceType}`,
      }),
    ])
  }
}
