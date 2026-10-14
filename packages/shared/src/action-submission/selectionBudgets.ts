import { branded } from "@guillaume-docquier/tools-ts"
import { safeTypedParse } from "@guillaume-docquier/tools-ts/schemas"
import type { Resources } from "#shared/domain/resources/Resources.ts"
import { ResourceType } from "#shared/domain/resources/ResourceType.ts"
import type { ActionDefinition } from "#shared/domain/ruleset/action-definitions/ActionDefinition.ts"
import type { InputTag } from "#shared/domain/ruleset/action-definitions/InputTag.ts"
import { PositiveIntegerSchema } from "#shared/domain/ruleset/action-definitions/PositiveInteger.ts"
import type { TargetTag } from "#shared/domain/ruleset/action-definitions/TargetTag.ts"
import type { EffectDefinition } from "#shared/domain/ruleset/effect-definitions/EffectDefinition.ts"
import { FleetColonizeEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetColonizeEffectDefinition.ts"
import { FleetMoveEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetMoveEffectDefinition.ts"
import type { Ruleset } from "#shared/domain/ruleset/Ruleset.ts"
import type { TargetId } from "#shared/domain/ruleset/target-definitions/TargetId.ts"
import type { Action } from "#shared/domain/turns/actions/Action.ts"
import type { ActionId } from "#shared/domain/turns/actions/ActionId.ts"
import type { Fleet } from "#shared/domain/world/fleets/Fleet.ts"
import type { FleetId } from "#shared/domain/world/fleets/FleetId.ts"
import {
  type EligibilityState,
  type ProposedSelection,
  type MutableEvaluation,
  getOwnRecordValue,
  addIssue,
  createZeroResources,
} from "./selectionEvaluation.ts"

export function evaluateResourceBudget({ state, proposals, authorizedActions, ruleset, evaluation }: BudgetContext): void {
  const running = createZeroResources()
  for (const proposal of proposals) {
    const action = authorizedActions.get(proposal.actionId)
    const definition = action === undefined ? undefined : getOwnRecordValue(ruleset.actionDefinitions, action.actionDefinitionId)
    if (definition === undefined) {
      continue
    }

    reserveResourceCosts(definition, proposal, running, { state, evaluation })
  }
}
function reserveResourceCosts(
  definition: ActionDefinition,
  proposal: ProposedSelection,
  running: Resources,
  { state, evaluation }: Pick<BudgetContext, "state" | "evaluation">,
): void {
  const actionCosts = createZeroResources()
  for (const cost of definition.costs) {
    actionCosts[cost.parameters.resourceType] += cost.parameters.quantity
  }
  for (const resourceType of Object.values(ResourceType)) {
    running[resourceType] += actionCosts[resourceType]
    evaluation.resourceCommitments[resourceType] += actionCosts[resourceType]
    if (running[resourceType] > state.resources[resourceType]) {
      addIssue(evaluation, {
        code: "INSUFFICIENT_RESOURCES",
        actionId: proposal.actionId,
        resourceType,
        message: `Missing ${running[resourceType] - state.resources[resourceType]} ${resourceType}`,
      })
    }
  }
}

export function evaluateStrengthBudget({ state, proposals, authorizedActions, ruleset, evaluation }: BudgetContext): void {
  const allocations = proposals.flatMap((proposal) => {
    const action = authorizedActions.get(proposal.actionId)
    const definition = action === undefined ? undefined : getOwnRecordValue(ruleset.actionDefinitions, action.actionDefinitionId)
    return definition === undefined ? [] : proposalStrengthAllocations(state, proposal, definition)
  })
  for (const [fleetId, reservations] of Map.groupBy(allocations, (a) => a.fleetId)) {
    reportStrengthBudget(state.fleets[fleetId], reservations, evaluation)
  }
}
function reportStrengthBudget(fleet: Fleet | undefined, allocations: readonly StrengthAllocation[], evaluation: MutableEvaluation): void {
  if (fleet === undefined) return
  const totalReserved = allocations.reduce((total, a) => total + a.strength, 0)
  if (totalReserved <= fleet.strength) return
  for (const allocation of allocations)
    addIssue(evaluation, {
      code: "INSUFFICIENT_STRENGTH",
      actionId: allocation.actionId,
      targetTag: allocation.targetTag,
      ...(allocation.inputTag === undefined ? {} : { inputTag: allocation.inputTag }),
      message: "The selected Fleet has " + fleet.strength + " Strength, but submitted Actions reserve " + totalReserved,
    })
}

export function addStrengthAllocation(
  state: EligibilityState,
  allocationsByFleet: Map<FleetId, Array<{ actionId: ActionId; targetTag: TargetTag; inputTag?: InputTag; strength: number }>>,
  fleetId: TargetId,
  allocation: { actionId: ActionId; targetTag: TargetTag; inputTag?: InputTag; strength: number },
): void {
  const brandedFleetId = branded<FleetId>(fleetId)
  if (getOwnRecordValue(state.fleets, brandedFleetId) === undefined) {
    return
  }
  allocationsByFleet.set(brandedFleetId, [...(allocationsByFleet.get(brandedFleetId) ?? []), allocation])
}

type BudgetContext = {
  state: EligibilityState
  proposals: readonly ProposedSelection[]
  authorizedActions: ReadonlyMap<ActionId, Action>
  ruleset: Ruleset
  evaluation: MutableEvaluation
}

type StrengthAllocation = { fleetId: FleetId; actionId: ActionId; targetTag: TargetTag; inputTag?: InputTag; strength: number }
/** Returns configured movement or stationary Colonize reservations for one proposal. */
export function proposalStrengthAllocations(
  state: EligibilityState,
  proposal: ProposedSelection,
  definition: ActionDefinition,
): StrengthAllocation[] {
  return definition.effects.flatMap((effect) => effectStrengthAllocation({ state, proposal, definition, effect }))
}
function effectStrengthAllocation({
  state,
  proposal,
  definition,
  effect,
}: {
  state: EligibilityState
  proposal: ProposedSelection
  definition: ActionDefinition
  effect: EffectDefinition
}): StrengthAllocation[] {
  if (effect.type !== FleetMoveEffectDefinition.type && effect.type !== FleetColonizeEffectDefinition.type) return []
  const fleetId = getOwnRecordValue(proposal.selectedTargets, effect.targets.fleet.actionTargetTag)
  if (fleetId === undefined || getOwnRecordValue(state.fleets, fleetId) === undefined) return []
  const common = { fleetId: branded<FleetId>(fleetId), actionId: proposal.actionId, targetTag: effect.targets.fleet.actionTargetTag }
  if (effect.type === FleetMoveEffectDefinition.type) {
    const strength = getOwnRecordValue(proposal.selectedInputs, effect.inputs.strength.actionInputTag)
    if (strength === undefined || !safeTypedParse(PositiveIntegerSchema, strength).success) return []
    return [{ ...common, inputTag: effect.inputs.strength.actionInputTag, strength }]
  }
  if (hasPairedMove(definition, effect)) return []
  return [{ ...common, strength: effect.parameters.strengthRequirement }]
}
/** Identifies a movement that carries this deferred arrival effect. */
export function hasPairedMove(definition: ActionDefinition, effect: FleetColonizeEffectDefinition): boolean {
  return definition.effects.some(
    (candidate) =>
      candidate.type === FleetMoveEffectDefinition.type &&
      candidate.targets.fleet.actionTargetTag === effect.targets.fleet.actionTargetTag &&
      candidate.targets.planet.actionTargetTag === effect.targets.planet.actionTargetTag,
  )
}
