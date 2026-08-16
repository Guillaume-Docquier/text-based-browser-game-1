import type { Rng } from "@guillaume-docquier/tools-ts"
import { v5 } from "uuid"
import type { Mechanic } from "#lib/rules-engine/ruleset-model/mechanics/Mechanic.ts"
import type { EffectJson } from "#lib/rules-engine/turn-resolution/effects/EffectJson.ts"
import type { TurnContext } from "#lib/rules-engine/turn-resolution/TurnContext.ts"

export abstract class Effect {
  public readonly id: string
  public readonly type: Mechanic["type"]

  protected constructor(type: Mechanic["type"], rng: Rng) {
    this.id = v5(rng.float().toString(), "effect-id") // might be collision prone?
    this.type = type
  }

  public resolve(context: TurnContext): void {
    this.doResolve(context)
    context.effects.markResolved(this)
  }

  protected abstract doResolve(context: TurnContext): void

  public toJson(): EffectJson {
    return { id: this.id, type: this.type }
  }
}
