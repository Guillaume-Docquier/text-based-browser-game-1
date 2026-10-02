import { Result } from "@guillaume-docquier/tools-ts"
import type { SubmittedAction } from "#shared/domain/actions/Action.ts"
import type { EffectOutcome } from "#shared/domain/actions/EffectOutcome.ts"
import type { EffectDefinition } from "#shared/domain/ruleset/effect-definitions/EffectDefinition.ts"
import type { EffectError } from "#shared/turn-resolution/effects/EffectError.ts"
import type { EffectJson } from "#shared/turn-resolution/effects/EffectJson.ts"
import type { TurnContext } from "#shared/turn-resolution/TurnContext.ts"

export abstract class Effect {
  public readonly id: number
  public readonly type: EffectDefinition["type"]

  /**
   * The action submission this effect is for
   */
  public readonly submittedAction: SubmittedAction

  protected constructor(id: number, type: EffectDefinition["type"], submittedAction: SubmittedAction) {
    this.id = id
    this.type = type
    this.submittedAction = submittedAction
  }

  /**
   * Effect outcomes are recorded automatically, no need to handle them.
   */
  public resolve(context: TurnContext): Result<EffectOutcome[], EffectError> {
    const result = this.doResolve(context)
    if (Result.isSuccess(result)) {
      context.effectPool.recordOutcomes(this, result.value)
    }

    return result
  }

  protected abstract doResolve(context: TurnContext): Result<EffectOutcome[], EffectError>

  public toJson(): EffectJson {
    return { id: this.id, type: this.type }
  }
}
