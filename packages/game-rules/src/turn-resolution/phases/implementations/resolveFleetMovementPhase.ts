import type { Result } from "@guillaume-docquier/tools-ts"
import { FleetMoveEffectDefinition } from "#game-rules/ruleset/effect-definitions/implementations/FleetMoveEffectDefinition.ts"
import { simplePhaseResolver } from "#game-rules/turn-resolution/phases/implementations/simplePhaseResolver.ts"
import type { ResolvePhaseError } from "#game-rules/turn-resolution/phases/ResolvePhaseError.ts"
import type { TurnContext } from "#game-rules/turn-resolution/TurnContext.ts"

export function resolveFleetMovementPhase(context: TurnContext): Result<TurnContext, ResolvePhaseError> {
  return simplePhaseResolver(FleetMoveEffectDefinition.type, context)
}
