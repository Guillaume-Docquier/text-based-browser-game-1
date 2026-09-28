import { Result } from "@guillaume-docquier/tools-ts"
import type { SubmittedAction } from "#game-rules/action-submission/Action.ts"
import type { ResourceLossEffectDefinition } from "#game-rules/ruleset/effect-definitions/implementations/ResourceLossEffectDefinition.ts"
import { Effect } from "#game-rules/turn-resolution/effects/Effect.ts"
import { EffectError } from "#game-rules/turn-resolution/effects/EffectError.ts"
import { EffectOutcome } from "#game-rules/turn-resolution/effects/EffectOutcome.ts"
import type { TurnContext } from "#game-rules/turn-resolution/TurnContext.ts"

export class ResourceLossEffect extends Effect {
  private readonly effectDefinition: ResourceLossEffectDefinition

  public constructor(id: number, effectDefinition: ResourceLossEffectDefinition, submittedAction: SubmittedAction) {
    super(id, effectDefinition.type, submittedAction)
    this.effectDefinition = effectDefinition
  }

  protected override doResolve(context: TurnContext): Result<EffectOutcome, EffectError> {
    const player = context.turnState.players[this.submittedAction.playerId]
    if (player === undefined) {
      return Result.Failure(EffectError.Failed({ error: `Could not resolve player with id "${this.submittedAction.playerId}"` }))
    }

    player.resources[this.effectDefinition.parameters.resourceType] -= this.effectDefinition.parameters.quantity
    if (player.resources[this.effectDefinition.parameters.resourceType] < 0) {
      return Result.Failure(
        EffectError.Failed({
          error: `Resource loss for Player "${this.submittedAction.playerId}" resulted in negative resources: ${this.effectDefinition.parameters.quantity} ${this.effectDefinition.parameters.resourceType}`,
        }),
      )
    }

    return Result.Success(
      EffectOutcome.Resolved({
        result: `Player "${this.submittedAction.playerId}" spent ${this.effectDefinition.parameters.quantity} ${this.effectDefinition.parameters.resourceType}`,
      }),
    )
  }
}
