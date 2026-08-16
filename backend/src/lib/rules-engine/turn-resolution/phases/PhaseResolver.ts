import type { Result } from "@guillaume-docquier/tools-ts"
import type { ResolvePhaseError } from "#lib/rules-engine/turn-resolution/phases/ResolvePhaseError.ts"
import type { TurnContext } from "#lib/rules-engine/turn-resolution/TurnContext.ts"

/**
 * A Phase takes a TurnState and an EffectPool, applies the Effects it knows how to handle, removing them from the Pool and mutating the TurnState.
 * For now a Phase doesn't return anything, but it could return some game logs of what happened and why.
 */
export type PhaseResolver = (context: TurnContext) => Result<TurnContext, ResolvePhaseError>
