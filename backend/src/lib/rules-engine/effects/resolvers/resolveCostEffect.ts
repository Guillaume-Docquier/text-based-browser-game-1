import type { Effect } from "#lib/rules-engine/effects/Effect.ts"
import type { CostMechanic } from "#lib/rules-engine/mechanics/implementations/CostMechanic.ts"
import type { PhaseContext } from "#lib/rules-engine/phases/PhaseContext.ts"

export function resolveCostEffect(_context: PhaseContext, _effect: Effect<CostMechanic>): void {}
