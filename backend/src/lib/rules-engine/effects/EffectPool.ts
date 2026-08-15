import type { Effect, EffectOfType } from "#lib/rules-engine/effects/Effect.ts"

/**
 * The EffectPool contains all the Effects that need to be applied to the TurnState
 */
export class EffectPool {
  private readonly effects: Set<Effect>

  public constructor(effects: Effect[]) {
    this.effects = new Set(effects)
  }

  public getEffectsOfType<TType extends Effect["type"]>(effectType: TType): Array<EffectOfType<TType>> {
    return this.effects
      .values()
      .filter((effect): effect is EffectOfType<TType> => effect.type === effectType)
      .toArray()
  }

  public addMany(effects: Effect[]): void {
    for (const effect of effects) {
      this.effects.add(effect)
    }
  }

  public markResolved(effect: Effect): void {
    this.effects.delete(effect)
  }

  public isEmpty(): boolean {
    return this.effects.size === 0
  }
}
