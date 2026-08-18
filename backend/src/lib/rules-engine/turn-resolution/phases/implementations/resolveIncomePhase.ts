import type { Result } from "@guillaume-docquier/tools-ts"
import { ResourceGainMechanic } from "#lib/rules-engine/ruleset-model/mechanics/implementations/ResourceGainMechanic.ts"
import { simplePhaseResolver } from "#lib/rules-engine/turn-resolution/phases/implementations/simplePhaseResolver.ts"
import type { ResolvePhaseError } from "#lib/rules-engine/turn-resolution/phases/ResolvePhaseError.ts"
import type { TurnContext } from "#lib/rules-engine/turn-resolution/TurnContext.ts"

export function resolveIncomePhase(context: TurnContext): Result<TurnContext, ResolvePhaseError> {
  return simplePhaseResolver(ResourceGainMechanic.type, context)
}
