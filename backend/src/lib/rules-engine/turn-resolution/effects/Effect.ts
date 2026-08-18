import type { Result } from "@guillaume-docquier/tools-ts"
import type { Mechanic } from "#lib/rules-engine/ruleset-model/mechanics/Mechanic.ts"
import type { EffectError } from "#lib/rules-engine/turn-resolution/effects/EffectError.ts"
import type { EffectJson } from "#lib/rules-engine/turn-resolution/effects/EffectJson.ts"
import type { EffectOutcome } from "#lib/rules-engine/turn-resolution/effects/EffectOutcome.ts"
import type { TurnContext } from "#lib/rules-engine/turn-resolution/TurnContext.ts"

export abstract class Effect {
  public readonly id: number
  public readonly type: Mechanic["type"]

  protected constructor(id: number, type: Mechanic["type"]) {
    this.id = id
    this.type = type
  }

  public abstract resolve(context: TurnContext): Result<EffectOutcome, EffectError>

  public toJson(): EffectJson {
    return { id: this.id, type: this.type }
  }
}
