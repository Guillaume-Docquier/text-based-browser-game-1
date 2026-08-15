import { Assert } from "@guillaume-docquier/tools-ts"
import { EffectPool } from "#lib/rules-engine/effects/EffectPool.ts"
import { reduceToEffects } from "#lib/rules-engine/turn-resolution/steps/reduceToEffects.ts"
import { resolvePhases } from "#lib/rules-engine/turn-resolution/steps/resolvePhases.ts"
import { validateActionSubmissions } from "#lib/rules-engine/turn-resolution/steps/validateActionSubmissions.ts"
import type { TurnContext } from "#lib/rules-engine/turn-resolution/TurnContext.ts"
import type { TurnState } from "#lib/rules-engine/turn-resolution/TurnState.ts"
import type { Ruleset } from "#lib/ruleset/Ruleset.ts"

/**
 * Takes a turn state and applies all its actions on it, then returns it.
 * The turnState is mutated in place. The returned value is the input.
 */
export function processTurn(turnState: TurnState, ruleset: Ruleset): TurnState {
  const context: TurnContext = {
    state: turnState,
    effects: new EffectPool([]),
    ruleset,
  }

  const actionSubmissionValidation = validateActionSubmissions(
    Object.values(turnState.players).flatMap((player) => player.actionSubmissions),
    ruleset,
    turnState,
  )

  context.effects.addMany(reduceToEffects(actionSubmissionValidation.valid, ruleset))

  resolvePhases(context)

  Assert.isTrue(context.effects.isEmpty())

  return context.state // TBD, probably want to return invalid actions and effect outcomes
}
