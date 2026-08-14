import { Assert } from "@guillaume-docquier/tools-ts"
import { buildTurnPlan, type InvalidActionSubmission } from "#lib/rules-engine/buildTurnPlan.ts"
import type { EffectOutcome } from "#lib/rules-engine/effects/EffectOutcome.ts"
import { EffectPool } from "#lib/rules-engine/effects/EffectPool.ts"
import { PHASE_ORDER, Phase } from "#lib/rules-engine/phases/Phase.ts"
import type { PhaseResolver } from "#lib/rules-engine/phases/PhaseResolver.ts"
import { resolveColonizationPhase } from "#lib/rules-engine/phases/resolvers/resolveColonizationPhase.ts"
import { resolveCombatPhase } from "#lib/rules-engine/phases/resolvers/resolveCombatPhase.ts"
import { resolveGovernancePhase } from "#lib/rules-engine/phases/resolvers/resolveGovernancePhase.ts"
import { resolveIncomePhase } from "#lib/rules-engine/phases/resolvers/resolveIncomePhase.ts"
import { resolvePayCostsPhase } from "#lib/rules-engine/phases/resolvers/resolvePayCostsPhase.ts"
import { resolveTravelPhase } from "#lib/rules-engine/phases/resolvers/resolveTravelPhase.ts"
import { resolveVictoryPhase } from "#lib/rules-engine/phases/resolvers/resolveVictoryPhase.ts"
import type { TurnContext } from "#lib/rules-engine/TurnContext.ts"
import type { TurnState } from "#lib/rules-engine/TurnState.ts"
import type { Ruleset } from "#lib/ruleset/Ruleset.ts"

const phaseResolvers = {
  [Phase.PAY_COSTS]: resolvePayCostsPhase,
  [Phase.TRAVEL]: resolveTravelPhase,
  [Phase.COMBAT]: resolveCombatPhase,
  [Phase.GOVERNANCE]: resolveGovernancePhase,
  [Phase.INCOME]: resolveIncomePhase,
  [Phase.COLONIZATION]: resolveColonizationPhase,
  [Phase.CHECK_VICTORY]: resolveVictoryPhase,
} as const satisfies Record<Phase, PhaseResolver>

export type TurnResolution = {
  readonly state: TurnState
  readonly invalidActionSubmissions: readonly InvalidActionSubmission[]
  readonly effectOutcomes: readonly EffectOutcome[]
}

/**
 * Takes a Turn State and applies all its valid Action Submissions.
 * The Turn State is mutated in place and returned with structured resolution outcomes.
 */
export function processTurn(turnState: TurnState, ruleset: Ruleset): TurnResolution {
  const turnPlan = buildTurnPlan(turnState, ruleset)
  const phaseContext: TurnContext = {
    state: turnState,
    effects: new EffectPool(turnPlan.effects),
    ruleset,
  }

  for (const phase of PHASE_ORDER) {
    phaseResolvers[phase](phaseContext)
  }

  // All effects should be accounted for
  Assert.isTrue(phaseContext.effects.isEmpty())

  return {
    state: phaseContext.state,
    invalidActionSubmissions: turnPlan.invalidActionSubmissions,
    effectOutcomes: phaseContext.effects.getOutcomes(),
  }
}
