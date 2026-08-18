import type { DeepReadonly } from "utility-types"
import type { Mechanic } from "#lib/rules-engine/ruleset-model/mechanics/Mechanic.ts"
import { type Effect } from "#lib/rules-engine/turn-resolution/effects/Effect.ts"
import { type EffectOutcome } from "#lib/rules-engine/turn-resolution/effects/EffectOutcome.ts"

/**
 * The EffectPool contains all the Effects that need to be applied to the TurnState
 */
export class EffectPool {
  private readonly effects: Set<Effect>

  // I don't know yet what I need here, so this is very basic for now
  private readonly outcomes: Array<DeepReadonly<EffectOutcome>> = []

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

  public recordOutcome(effect: Effect, outcome: DeepReadonly<EffectOutcome>): void {
    this.effects.delete(effect)
    this.outcomes.push(outcome)
  }

  public getOutcomes(): DeepReadonly<EffectOutcome[]> {
    return this.outcomes
  }
}
