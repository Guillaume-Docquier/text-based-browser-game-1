import type { Effect } from "#lib/rules-engine/effects/Effect.ts"
import type { VictoryMechanic } from "#lib/rules-engine/mechanics/VictoryMechanic.ts"
import type { PhaseContext } from "#lib/rules-engine/phases/PhaseContext.ts"

export function resolveVictoryEffect(_context: PhaseContext, _effect: Effect<VictoryMechanic>): void {}
