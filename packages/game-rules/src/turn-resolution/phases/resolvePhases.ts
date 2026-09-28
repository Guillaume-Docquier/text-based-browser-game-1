import { Result } from "@guillaume-docquier/tools-ts"
import { resolveColonizationPhase } from "game-rules/turn-resolution/phases/implementations/resolveColonizationPhase.ts"
import { resolveFleetBuildPhase } from "game-rules/turn-resolution/phases/implementations/resolveFleetBuildPhase.ts"
import { resolveFleetCombatPhase } from "game-rules/turn-resolution/phases/implementations/resolveFleetCombatPhase.ts"
import { resolveFleetMovementPhase } from "game-rules/turn-resolution/phases/implementations/resolveFleetMovementPhase.ts"
import { resolveIncomePhase } from "game-rules/turn-resolution/phases/implementations/resolveIncomePhase.ts"
import { resolvePayCostsPhase } from "game-rules/turn-resolution/phases/implementations/resolvePayCostsPhase.ts"
import { resolvePlanetPhase } from "game-rules/turn-resolution/phases/implementations/resolvePlanetPhase.ts"
import { resolveVictoryPhase } from "game-rules/turn-resolution/phases/implementations/resolveVictoryPhase.ts"
import type { PhaseResolver } from "game-rules/turn-resolution/phases/PhaseResolver.ts"
import type { ResolvePhaseError } from "game-rules/turn-resolution/phases/ResolvePhaseError.ts"
import type { TurnContext } from "game-rules/turn-resolution/TurnContext.ts"

const phaseResolvers: PhaseResolver[] = [
  resolvePayCostsPhase,
  resolveFleetMovementPhase,
  resolveFleetBuildPhase,
  resolveFleetCombatPhase,
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
