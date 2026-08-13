import type { Effect } from "#lib/rules-engine/effects/Effect.ts"
import type { IncomeMechanic } from "#lib/rules-engine/mechanics/IncomeMechanic.ts"
import type { PhaseContext } from "#lib/rules-engine/phases/PhaseContext.ts"

export function resolveIncomeEffect(_context: PhaseContext, _effect: Effect<IncomeMechanic>): void {}
