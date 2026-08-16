import type { Mechanic } from "#lib/rules-engine/ruleset-model/mechanics/Mechanic.ts"
import type { TurnContext } from "#lib/rules-engine/turn-resolution/TurnContext.ts"

export abstract class Effect {
  public readonly type: Mechanic["type"]

  protected constructor(type: Mechanic["type"]) {
    this.type = type
  }

  public resolve(context: TurnContext): void {
    this.doResolve(context)
    context.effects.markResolved(this)
  }

  protected abstract doResolve(context: TurnContext): void
}
