import type { SubmittedAction } from "#shared/domain/actions/Action.ts"
import type { EffectOutcome } from "#shared/domain/actions/EffectOutcome.ts"
import type { EffectDefinition } from "#shared/domain/ruleset/effect-definitions/EffectDefinition.ts"
import type { Effect } from "#shared/turn-resolution/effects/Effect.ts"

/**
 * The EffectPool contains all the Effects that need to be applied to the TurnState
 */
export class EffectPool {
  private readonly effects: Set<Effect>

  // maybe this shouldn't live in the effect pool
  private readonly outcomes = new Map<SubmittedAction, EffectOutcome[]>()

  public constructor(effects: Effect[]) {
    this.effects = new Set(effects)
  }

  public getAll(): Effect[] {
    return Array.from(this.effects)
  }

  public getEffectsOfType(type: EffectDefinition["type"]): Effect[] {
    return this.effects
      .values()
      .filter((effect) => effect.type === type)
      .toArray()
  }

  public addMany(effects: Effect[]): void {
    for (const effect of effects) {
      this.effects.add(effect)
    }
  }

  public isEmpty(): boolean {
    return this.effects.size === 0
  }

  public recordOutcomes(effect: Effect, outcomes: readonly EffectOutcome[]): void {
    this.effects.delete(effect)
    this.outcomes.getOrInsert(effect.submittedAction, []).push(...outcomes)
  }

  public getOutcomes(submittedAction: SubmittedAction): readonly EffectOutcome[] {
    return this.outcomes.getOrInsert(submittedAction, [])
  }
}
