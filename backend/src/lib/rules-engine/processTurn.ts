import { Assert } from "@guillaume-docquier/tools-ts"
import { EffectPool } from "#lib/rules-engine/EffectPool.ts"
import type { PhaseContext } from "#lib/rules-engine/phases/PhaseContext.ts"
import type { PhaseResolver } from "#lib/rules-engine/phases/PhaseResolver.ts"
import { resolveColonizationPhase } from "#lib/rules-engine/phases/resolvers/resolveColonizationPhase.ts"
import { resolveCombatPhase } from "#lib/rules-engine/phases/resolvers/resolveCombatPhase.ts"
import { resolveGovernancePhase } from "#lib/rules-engine/phases/resolvers/resolveGovernancePhase.ts"
import { resolveIncomePhase } from "#lib/rules-engine/phases/resolvers/resolveIncomePhase.ts"
import { resolveMovementPhase } from "#lib/rules-engine/phases/resolvers/resolveMovementPhase.ts"
import { resolvePayCostsPhase } from "#lib/rules-engine/phases/resolvers/resolvePayCostsPhase.ts"
import type { TurnState } from "#lib/rules-engine/TurnState.ts"
import type { Ruleset } from "#lib/ruleset/ruleset.ts"

const phaseResolvers: PhaseResolver[] = [
  resolveMovementPhase,
  resolveCombatPhase,
  resolveGovernancePhase,
  resolveColonizationPhase,
  resolveIncomePhase,
]

/**
 * Takes a turn state and applies all its actions on it, then returns the new turn state.
 */
export function processTurn(turnState: Readonly<TurnState>, ruleset: Ruleset): TurnState {
  const phaseContext: PhaseContext = {
    state: structuredClone(turnState),
    effects: new EffectPool([]),
    ruleset,
  }
  const actionSubmissions = Object.values(turnState.players).flatMap((player) => player.actionSubmissions)

  resolvePayCostsPhase(phaseContext, actionSubmissions, ruleset) // The pay costs phase is a bit special
  for (const phaseResolver of phaseResolvers) {
    phaseResolver(phaseContext)
  }

  // All effects should be accounted for
  Assert.isTrue(phaseContext.effects.isEmpty())

  return phaseContext.state
}
