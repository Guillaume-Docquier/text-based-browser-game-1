import { Assert } from "@guillaume-docquier/tools-ts"
import type { ActionSubmission } from "#lib/rules-engine/actions/ActionSubmission.ts"
import { EffectPool } from "#lib/rules-engine/effects/EffectPool.ts"
import type { PhaseResolver } from "#lib/rules-engine/phases/PhaseResolver.ts"
import { resolveColonizationPhase } from "#lib/rules-engine/phases/resolvers/resolveColonizationPhase.ts"
import { resolveCombatPhase } from "#lib/rules-engine/phases/resolvers/resolveCombatPhase.ts"
import { resolveGovernancePhase } from "#lib/rules-engine/phases/resolvers/resolveGovernancePhase.ts"
import { resolveIncomePhase } from "#lib/rules-engine/phases/resolvers/resolveIncomePhase.ts"
import { resolveMovementPhase } from "#lib/rules-engine/phases/resolvers/resolveMovementPhase.ts"
import { resolvePayCostsPhase } from "#lib/rules-engine/phases/resolvers/resolvePayCostsPhase.ts"
import { resolveVictoryPhase } from "#lib/rules-engine/phases/resolvers/resolveVictoryPhase.ts"
import type { TurnContext } from "#lib/rules-engine/TurnContext.ts"
import type { TurnState } from "#lib/rules-engine/TurnState.ts"
import type { Ruleset } from "#lib/ruleset/Ruleset.ts"

const phaseResolvers: PhaseResolver[] = [
  // resolvePayCostsPhase // The pay costs phase is a bit special
  resolveMovementPhase,
  resolveCombatPhase,
  resolveGovernancePhase,
  resolveColonizationPhase,
  resolveIncomePhase,
  resolveVictoryPhase,
]

/**
 * Takes a turn state and applies all its actions on it, then returns it.
 * The turnState is mutated in place. The returned value is the input.
 */
export function processTurn(turnState: TurnState, ruleset: Ruleset): TurnState {
  const phaseContext: TurnContext = {
    state: turnState,
    effects: new EffectPool([]),
    ruleset,
  }
  const actionSubmissionValidation = validateActionSubmissions(
    Object.values(turnState.players).flatMap((player) => player.actionSubmissions),
  )

  resolvePayCostsPhase(phaseContext, actionSubmissionValidation.valid, ruleset) // The pay costs phase is a bit special
  for (const resolvePhase of phaseResolvers) {
    resolvePhase(phaseContext)
  }

  // All effects should be accounted for
  Assert.isTrue(phaseContext.effects.isEmpty())

  return phaseContext.state
}

function validateActionSubmissions(actionSubmissions: ActionSubmission[]): { valid: ActionSubmission[]; invalid: ActionSubmission[] } {
  // TODO Implement
  // Check targets
  // Check costs <-- If we do this here, then payCostsPhase is a normal phase
  // Check action definitions
  // Aka all integrity pre conditions
  // This might be its own pipeline?
  return {
    valid: actionSubmissions,
    invalid: [],
  }
}
