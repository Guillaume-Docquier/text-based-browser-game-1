import type { PhaseResolver } from "#lib/rules-engine/phases/PhaseResolver.ts"
import { resolveColonizationPhase } from "#lib/rules-engine/phases/resolvers/resolveColonizationPhase.ts"
import { resolveCombatPhase } from "#lib/rules-engine/phases/resolvers/resolveCombatPhase.ts"
import { resolveIncomePhase } from "#lib/rules-engine/phases/resolvers/resolveIncomePhase.ts"
import { resolveMovementPhase } from "#lib/rules-engine/phases/resolvers/resolveMovementPhase.ts"
import { resolvePayCostsPhase } from "#lib/rules-engine/phases/resolvers/resolvePayCostsPhase.ts"
import { resolvePlanetPhase } from "#lib/rules-engine/phases/resolvers/resolvePlanetPhase.ts"
import { resolveVictoryPhase } from "#lib/rules-engine/phases/resolvers/resolveVictoryPhase.ts"
import type { TurnContext } from "#lib/rules-engine/turn-resolution/TurnContext.ts"

const phaseResolvers: PhaseResolver[] = [
  resolvePayCostsPhase,
  resolveMovementPhase,
  resolveCombatPhase,
  resolvePlanetPhase,
  resolveColonizationPhase,
  resolveIncomePhase,
  resolveVictoryPhase,
]

export function resolvePhases(context: TurnContext): void {
  for (const resolvePhase of phaseResolvers) {
    resolvePhase(context)
  }
}
