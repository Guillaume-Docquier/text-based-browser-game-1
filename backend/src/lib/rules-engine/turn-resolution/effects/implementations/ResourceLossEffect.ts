import { Result } from "@guillaume-docquier/tools-ts"
import { PlayerId } from "#api/shared/PlayerId.ts"
import type { SubmittedAction } from "#lib/rules-engine/action-submission/Action.ts"
import type { ResourceLossMechanic } from "#lib/rules-engine/ruleset-model/mechanics/implementations/ResourceLossMechanic.ts"
import { Effect } from "#lib/rules-engine/turn-resolution/effects/Effect.ts"
import { EffectError } from "#lib/rules-engine/turn-resolution/effects/EffectError.ts"
import { EffectOutcome } from "#lib/rules-engine/turn-resolution/effects/EffectOutcome.ts"
import type { TurnContext } from "#lib/rules-engine/turn-resolution/TurnContext.ts"

export class ResourceLossEffect extends Effect {
  private readonly mechanic: ResourceLossMechanic
  private readonly targetPlayerId: string

  public constructor(id: number, mechanic: ResourceLossMechanic, submittedAction: SubmittedAction) {
    super(id, mechanic.type, submittedAction)
    this.mechanic = mechanic
    this.targetPlayerId = submittedAction.targets[mechanic.targets.player.tag]
  }

  protected override doResolve(context: TurnContext): Result<EffectOutcome, EffectError> {
    const player = context.turnState.players[PlayerId.parse(this.targetPlayerId)]
    if (player === undefined) {
      return Result.Failure(EffectError.Failed({ error: `Could not resolve player with id "${this.targetPlayerId}"` }))
    }

    player.resources[this.mechanic.resourceType] -= this.mechanic.quantity
    if (player.resources[this.mechanic.resourceType] < 0) {
      return Result.Failure(
        EffectError.Failed({
          error: `Resource loss for Player "${this.targetPlayerId}" resulted in negative resources: ${this.mechanic.quantity} ${this.mechanic.resourceType}`,
        }),
      )
    }

    return Result.Success(
      EffectOutcome.Resolved({ result: `Player "${this.targetPlayerId}" spent ${this.mechanic.quantity} ${this.mechanic.resourceType}` }),
    )
  }
}
