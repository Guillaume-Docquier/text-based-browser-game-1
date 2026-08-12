import type { Effect, EffectOfType } from "#turn-processing/engine/effects/Effect.ts"

/**
 * The EffectPool contains all the Effects that need to be applied to the TurnState
 */
export class EffectPool {
  private readonly effects: Effect[]

  public constructor(effects: Effect[]) {
    this.effects = effects
  }

  public getEffectsOfType<TType extends Effect["type"]>(effectType: TType): Array<EffectOfType<TType>> {
    return this.effects.filter((effect): effect is EffectOfType<TType> => effect.type === effectType)
  }

  public isEmpty(): boolean {
    return this.effects.length === 0
  }
}
