import type { Result } from "@guillaume-docquier/tools-ts"
import { FleetBuildEffectDefinition } from "game-rules/ruleset/effect-definitions/implementations/FleetBuildEffectDefinition.ts"
import { simplePhaseResolver } from "game-rules/turn-resolution/phases/implementations/simplePhaseResolver.ts"
import type { ResolvePhaseError } from "game-rules/turn-resolution/phases/ResolvePhaseError.ts"
import type { TurnContext } from "game-rules/turn-resolution/TurnContext.ts"

export function resolveFleetBuildPhase(context: TurnContext): Result<TurnContext, ResolvePhaseError> {
  return simplePhaseResolver(FleetBuildEffectDefinition.type, context)
}
