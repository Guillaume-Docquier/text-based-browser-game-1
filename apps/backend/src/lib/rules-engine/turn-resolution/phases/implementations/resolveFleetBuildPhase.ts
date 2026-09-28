import type { Result } from "@guillaume-docquier/tools-ts"
import { FleetBuildEffectDefinition } from "#lib/rules-engine/ruleset/effect-definitions/implementations/FleetBuildEffectDefinition.ts"
import { simplePhaseResolver } from "#lib/rules-engine/turn-resolution/phases/implementations/simplePhaseResolver.ts"
import type { ResolvePhaseError } from "#lib/rules-engine/turn-resolution/phases/ResolvePhaseError.ts"
import type { TurnContext } from "#lib/rules-engine/turn-resolution/TurnContext.ts"

export function resolveFleetBuildPhase(context: TurnContext): Result<TurnContext, ResolvePhaseError> {
  return simplePhaseResolver(FleetBuildEffectDefinition.type, context)
}
