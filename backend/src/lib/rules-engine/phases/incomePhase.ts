import { IncomeMechanic } from "#lib/rules-engine/mechanics/IncomeMechanic.ts"
import type { PhaseContext } from "#lib/rules-engine/phases/PhaseContext.ts"

export function incomePhase(context: PhaseContext): void {
  const incomeEffects = context.effects.getEffectsOfType(IncomeMechanic.type)
  for (const incomeAction of incomeEffects) {
  }
}
