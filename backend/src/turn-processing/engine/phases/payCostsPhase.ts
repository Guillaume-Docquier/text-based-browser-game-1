import { CostMechanic } from "#turn-processing/engine/mechanics/CostMechanic.ts"
import type { PhaseContext } from "#turn-processing/engine/phases/PhaseContext.ts"

export function payCostsPhase(context: PhaseContext): void {
  const costs = context.effects.getEffectsOfType(CostMechanic.id)
  for (const cost of costs) {
    const rt = cost.mechanic.resourceType // this works!
    const q = cost.mechanic.quantity // this works!

    // TODO Need action context to know who did the action and thus should pay the cost
  }
}
