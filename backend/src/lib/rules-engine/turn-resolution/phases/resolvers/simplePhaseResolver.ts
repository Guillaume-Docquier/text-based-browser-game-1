import type { Mechanic } from "#lib/rules-engine/ruleset-model/mechanics/Mechanic.ts"
import { resolveEffect } from "#lib/rules-engine/turn-resolution/effects/resolveEffect.ts"
import type { TurnContext } from "#lib/rules-engine/turn-resolution/TurnContext.ts"

/**
 * A resolver that collects a single mechanic type and resolves them with no further logic.
 */
export function simplePhaseResolver(mechanicType: Mechanic["type"], context: TurnContext): void {
  for (const effect of context.effects.getEffectsOfType(mechanicType)) {
    resolveEffect(context, effect)
  }
}
