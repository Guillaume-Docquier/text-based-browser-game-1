import type { Result } from "@guillaume-docquier/tools-ts"
import { FleetBuildEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetBuildEffectDefinition.ts"
import { simplePhaseResolver } from "#shared/turn-resolution/phases/implementations/simplePhaseResolver.ts"
import type { ResolvePhaseError } from "#shared/turn-resolution/phases/ResolvePhaseError.ts"
import type { TurnContext } from "#shared/turn-resolution/TurnContext.ts"

export function resolveFleetBuildPhase(context: TurnContext): Result<TurnContext, ResolvePhaseError> {
  return simplePhaseResolver(FleetBuildEffectDefinition.type, context)
}
