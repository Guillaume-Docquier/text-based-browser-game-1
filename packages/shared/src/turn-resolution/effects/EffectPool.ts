import { Result } from "@guillaume-docquier/tools-ts"
import type { EffectDefinition } from "#shared/domain/ruleset/effect-definitions/EffectDefinition.ts"
import type { SubmittedAction } from "#shared/domain/turns/actions/Action.ts"
import { actionOriginKey, sameSubmission, type ActionResolutionOrigin } from "#shared/domain/turns/actions/ActionResolutionOrigin.ts"
import type { EffectOutcome } from "#shared/domain/turns/actions/EffectOutcome.ts"
import type { Effect } from "#shared/turn-resolution/effects/Effect.ts"
import { EffectError } from "#shared/turn-resolution/effects/EffectError.ts"

export class EffectPool {
  private readonly effects: Set<Effect>
  private readonly outcomes = new Map<string, { origin: ActionResolutionOrigin; outcomes: EffectOutcome[] }>()
  public constructor(effects: Effect[]) {
    this.effects = new Set(effects)
  }
  public getAll(): Effect[] {
    return Array.from(this.effects)
  }
  public getEffectsOfType(type: EffectDefinition["type"]): Effect[] {
    return this.getAll().filter((effect) => effect.type === type)
  }
  public addMany(effects: Effect[]): void {
    for (const effect of effects) this.effects.add(effect)
  }
  public isEmpty(): boolean {
    return this.effects.size === 0
  }
  public recordOutcomes(effect: Effect, outcomes: readonly EffectOutcome[]): Result<void, EffectError> {
    const origin = effect.origin
    if (origin === undefined) return Result.Failure(EffectError.Failed({ error: "Missing effect origin" }))
    const key = actionOriginKey(origin)
    const group = this.outcomes.get(key)
    if (group !== undefined && !sameSubmission(group.origin.submittedAction, origin.submittedAction))
      return Result.Failure(EffectError.Failed({ error: "Conflicting action resolution origin" }))
    this.effects.delete(effect)
    if (group === undefined) this.outcomes.set(key, { origin, outcomes: [...outcomes] })
    else group.outcomes.push(...outcomes)
    return Result.Success(undefined)
  }
  public getOrigins(): ActionResolutionOrigin[] {
    return Array.from(this.outcomes.values(), ({ origin }) => origin)
  }
  public getOutcomes(submittedAction: SubmittedAction, initiatingTurn?: number): readonly EffectOutcome[] {
    return Array.from(this.outcomes.values())
      .filter(
        (group) =>
          sameSubmission(group.origin.submittedAction, submittedAction) &&
          (initiatingTurn === undefined || group.origin.initiatingTurn === initiatingTurn),
      )
      .flatMap((group) => group.outcomes)
  }
}
