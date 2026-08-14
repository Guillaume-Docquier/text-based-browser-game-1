import { Assert } from "@guillaume-docquier/tools-ts"
import type { Effect, EffectOfType } from "#lib/rules-engine/effects/Effect.ts"
import type { EffectOutcome } from "#lib/rules-engine/effects/EffectOutcome.ts"

/**
 * The EffectPool contains all the Effects that need to be applied to the TurnState
 */
export class EffectPool {
  private readonly effects = new Map<Effect["id"], Effect>()
  private readonly outcomes: EffectOutcome[] = []

  public constructor(effects: readonly Effect[]) {
    this.addMany(effects)
  }

  public getEffectsOfType<TType extends Effect["type"]>(effectType: TType): Array<EffectOfType<TType>> {
    return this.getAll()
      .filter((effect): effect is EffectOfType<TType> => effect.type === effectType)
      .toSorted(compareEffects)
  }

  public getAll(): Effect[] {
    return this.effects.values().toArray().toSorted(compareEffects)
  }

  public addMany(effects: readonly Effect[]): void {
    for (const effect of effects) {
      Assert.isTrue(this.effects.get(effect.id) === undefined)
      this.effects.set(effect.id, effect)
    }
  }

  public complete(effect: Effect, outcome: EffectOutcome): void {
    Assert.isDefined(this.effects.get(effect.id))
    Assert.isTrue(outcome.effectId === effect.id)
    this.effects.delete(effect.id)
    this.outcomes.push(outcome)
  }

  public getOutcomes(): readonly EffectOutcome[] {
    return [...this.outcomes]
  }

  public isEmpty(): boolean {
    return this.effects.size === 0
  }
}

function compareEffects(left: Effect, right: Effect): number {
  if (left.mechanicOrder !== right.mechanicOrder) return left.mechanicOrder - right.mechanicOrder
  if (left.origin.actionSubmissionId < right.origin.actionSubmissionId) return -1
  if (left.origin.actionSubmissionId > right.origin.actionSubmissionId) return 1
  if (left.origin.mechanicIndex !== right.origin.mechanicIndex) return left.origin.mechanicIndex - right.origin.mechanicIndex
  if (left.id < right.id) return -1
  if (left.id > right.id) return 1
  return 0
}
