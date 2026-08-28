import { Result } from "@guillaume-docquier/tools-ts"
import type { SubmittedAction } from "#lib/rules-engine/action-submission/Action.ts"
import type { Mechanic } from "#lib/rules-engine/ruleset-model/mechanics/Mechanic.ts"
import type { EffectError } from "#lib/rules-engine/turn-resolution/effects/EffectError.ts"
import type { EffectJson } from "#lib/rules-engine/turn-resolution/effects/EffectJson.ts"
import type { EffectOutcome } from "#lib/rules-engine/turn-resolution/effects/EffectOutcome.ts"
import type { TurnContext } from "#lib/rules-engine/turn-resolution/TurnContext.ts"

export abstract class Effect {
  public readonly id: number
  public readonly type: Mechanic["type"]

  /**
   * The action submission this effect is for
   */
  public readonly submittedAction: SubmittedAction

  protected constructor(id: number, type: Mechanic["type"], submittedAction: SubmittedAction) {
    this.id = id
    this.type = type
    this.submittedAction = submittedAction
  }

  /**
   * Effect outcomes are recorded automatically, no need to handle them.
   */
  public resolve(context: TurnContext): Result<EffectOutcome, EffectError> {
    const result = this.doResolve(context)
    if (Result.isSuccess(result)) {
      context.effectPool.recordOutcome(this, result.value)
    }

    return result
  }

  protected abstract doResolve(context: TurnContext): Result<EffectOutcome, EffectError>

  public toJson(): EffectJson {
    return { id: this.id, type: this.type }
  }
}
