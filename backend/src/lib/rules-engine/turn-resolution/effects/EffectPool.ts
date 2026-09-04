import type { SubmittedAction } from "#lib/rules-engine/action-submission/Action.ts"
import type { Mechanic } from "#lib/rules-engine/ruleset-model/mechanics/Mechanic.ts"
import type { Effect } from "#lib/rules-engine/turn-resolution/effects/Effect.ts"
import type { EffectOutcome } from "#lib/rules-engine/turn-resolution/effects/EffectOutcome.ts"

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

  public getEffectsOfType(type: Mechanic["type"]): Effect[] {
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

  public recordOutcome(effect: Effect, outcome: EffectOutcome): void {
    this.effects.delete(effect)
    this.outcomes.getOrInsert(effect.submittedAction, []).push(outcome)
  }

  public getOutcomes(submittedAction: SubmittedAction): readonly EffectOutcome[] {
    return this.outcomes.getOrInsert(submittedAction, [])
  }
}
