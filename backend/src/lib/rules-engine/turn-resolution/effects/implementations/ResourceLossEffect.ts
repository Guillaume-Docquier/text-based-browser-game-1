import { Result } from "@guillaume-docquier/tools-ts"
import type { SubmittedAction } from "#lib/rules-engine/action-submission/Action.ts"
import type { ResourceLossMechanic } from "#lib/rules-engine/ruleset-model/mechanics/implementations/ResourceLossMechanic.ts"
import { Effect } from "#lib/rules-engine/turn-resolution/effects/Effect.ts"
import { EffectError } from "#lib/rules-engine/turn-resolution/effects/EffectError.ts"
import { EffectOutcome } from "#lib/rules-engine/turn-resolution/effects/EffectOutcome.ts"
import type { TurnContext } from "#lib/rules-engine/turn-resolution/TurnContext.ts"

export class ResourceLossEffect extends Effect {
  private readonly mechanic: ResourceLossMechanic

  public constructor(id: number, mechanic: ResourceLossMechanic, submittedAction: SubmittedAction) {
    super(id, mechanic.type, submittedAction)
    this.mechanic = mechanic
  }

  protected override doResolve(context: TurnContext): Result<EffectOutcome, EffectError> {
    const player = context.turnState.players[this.submittedAction.playerId]
    if (player === undefined) {
      return Result.Failure(EffectError.Failed({ error: `Could not resolve player with id "${this.submittedAction.playerId}"` }))
    }

    player.resources[this.mechanic.parameters.resourceType] -= this.mechanic.parameters.quantity
    if (player.resources[this.mechanic.parameters.resourceType] < 0) {
      return Result.Failure(
        EffectError.Failed({
          error: `Resource loss for Player "${this.submittedAction.playerId}" resulted in negative resources: ${this.mechanic.parameters.quantity} ${this.mechanic.parameters.resourceType}`,
        }),
      )
    }

    return Result.Success(
      EffectOutcome.Resolved({
        result: `Player "${this.submittedAction.playerId}" spent ${this.mechanic.parameters.quantity} ${this.mechanic.parameters.resourceType}`,
      }),
    )
  }
}
