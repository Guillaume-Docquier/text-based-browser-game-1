import { Result } from "@guillaume-docquier/tools-ts"
import type { ResolvePhaseError } from "#lib/rules-engine/turn-resolution/phases/ResolvePhaseError.ts"
import type { TurnContext } from "#lib/rules-engine/turn-resolution/TurnContext.ts"

export function resolveColonizationPhase(context: TurnContext): Result<TurnContext, ResolvePhaseError> {
  // not yet implemented
  return Result.Success(context)
}
