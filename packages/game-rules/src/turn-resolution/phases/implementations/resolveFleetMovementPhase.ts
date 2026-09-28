import { Result } from "@guillaume-docquier/tools-ts"
import type { ResolvePhaseError } from "game-rules/turn-resolution/phases/ResolvePhaseError.ts"
import type { TurnContext } from "game-rules/turn-resolution/TurnContext.ts"

export function resolveFleetMovementPhase(context: TurnContext): Result<TurnContext, ResolvePhaseError> {
  // not yet implemented
  return Result.Success(context)
}
