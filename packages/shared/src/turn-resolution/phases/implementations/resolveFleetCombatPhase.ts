import { Result } from "@guillaume-docquier/tools-ts"
import type { ResolvePhaseError } from "#shared/turn-resolution/phases/ResolvePhaseError.ts"
import type { TurnContext } from "#shared/turn-resolution/TurnContext.ts"

export function resolveFleetCombatPhase(context: TurnContext): Result<TurnContext, ResolvePhaseError> {
  // not yet implemented
  return Result.Success(context)
}
