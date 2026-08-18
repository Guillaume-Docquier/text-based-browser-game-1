import type { Result } from "@guillaume-docquier/tools-ts"
import { ResourceLossMechanic } from "#lib/rules-engine/ruleset-model/mechanics/implementations/ResourceLossMechanic.ts"
import { simplePhaseResolver } from "#lib/rules-engine/turn-resolution/phases/implementations/simplePhaseResolver.ts"
import type { ResolvePhaseError } from "#lib/rules-engine/turn-resolution/phases/ResolvePhaseError.ts"
import type { TurnContext } from "#lib/rules-engine/turn-resolution/TurnContext.ts"

export function resolvePayCostsPhase(context: TurnContext): Result<TurnContext, ResolvePhaseError> {
  return simplePhaseResolver(ResourceLossMechanic.type, context)
}
