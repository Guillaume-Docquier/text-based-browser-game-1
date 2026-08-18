import { Result } from "@guillaume-docquier/tools-ts"
import { resolveColonizationPhase } from "#lib/rules-engine/turn-resolution/phases/implementations/resolveColonizationPhase.ts"
import { resolveCombatPhase } from "#lib/rules-engine/turn-resolution/phases/implementations/resolveCombatPhase.ts"
import { resolveIncomePhase } from "#lib/rules-engine/turn-resolution/phases/implementations/resolveIncomePhase.ts"
import { resolveMovementPhase } from "#lib/rules-engine/turn-resolution/phases/implementations/resolveMovementPhase.ts"
import { resolvePayCostsPhase } from "#lib/rules-engine/turn-resolution/phases/implementations/resolvePayCostsPhase.ts"
import { resolvePlanetPhase } from "#lib/rules-engine/turn-resolution/phases/implementations/resolvePlanetPhase.ts"
import { resolveVictoryPhase } from "#lib/rules-engine/turn-resolution/phases/implementations/resolveVictoryPhase.ts"
import type { PhaseResolver } from "#lib/rules-engine/turn-resolution/phases/PhaseResolver.ts"
import type { ResolvePhaseError } from "#lib/rules-engine/turn-resolution/phases/ResolvePhaseError.ts"
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

/**
 * Mutates the context
 */
export function resolvePhases(context: TurnContext): Result<TurnContext, ResolvePhaseError> {
  for (const resolvePhase of phaseResolvers) {
    const result = resolvePhase(context)
    if (Result.isFailure(result)) {
      return result
    }
  }

  return Result.Success(context)
}
