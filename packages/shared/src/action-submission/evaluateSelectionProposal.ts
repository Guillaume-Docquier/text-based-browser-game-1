import { branded } from "@guillaume-docquier/tools-ts"
import { safeTypedParse } from "@guillaume-docquier/tools-ts/schemas"
import type { ActionDefinition } from "#shared/domain/ruleset/action-definitions/ActionDefinition.ts"
import type { InputTag } from "#shared/domain/ruleset/action-definitions/InputTag.ts"
import { PositiveIntegerSchema } from "#shared/domain/ruleset/action-definitions/PositiveInteger.ts"
import type { TargetTag } from "#shared/domain/ruleset/action-definitions/TargetTag.ts"
import { FleetColonizeEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetColonizeEffectDefinition.ts"
import { FleetMoveEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetMoveEffectDefinition.ts"
import type { Ruleset } from "#shared/domain/ruleset/Ruleset.ts"
import type { Action } from "#shared/domain/turns/actions/Action.ts"
import type { ActionId } from "#shared/domain/turns/actions/ActionId.ts"
import type { Fleet } from "#shared/domain/world/fleets/Fleet.ts"
import { getFleetColonizationEligibility } from "#shared/domain/world/fleets/fleetColonizationEligibility.ts"
import type { FleetId } from "#shared/domain/world/fleets/FleetId.ts"
import type { PlanetId } from "#shared/domain/world/planets/PlanetId.ts"
import { evaluateTarget } from "./evaluateSelectionTarget.ts"
import { findOccupyingFleet } from "./findOccupyingFleet.ts"
import { proposalStrengthAllocations } from "./selectionBudgets.ts"
import {
  type EligibilityState,
  type ProposedSelection,
  type MutableEvaluation,
  getOwnRecordValue,
  addIssue,
} from "./selectionEvaluation.ts"

export function evaluateProposal({
  state,
  ruleset,
  proposal,
  authorizedActions,
  evaluation,
}: {
  state: EligibilityState
  ruleset: Ruleset
  proposal: ProposedSelection
  authorizedActions: ReadonlyMap<ActionId, Action>
  evaluation: MutableEvaluation
}): void {
  const action = authorizedActions.get(proposal.actionId)
  if (action === undefined) {
    addIssue(evaluation, {
      code: "ACTION_NOT_AUTHORIZED",
      actionId: proposal.actionId,
      message: `Action instance "${proposal.actionId}" is not available to this player and turn`,
    })
    return
  }

  const actionDefinition = getOwnRecordValue(ruleset.actionDefinitions, action.actionDefinitionId)
  if (actionDefinition === undefined) {
    addIssue(evaluation, {
      code: "ACTION_DEFINITION_MISSING",
      actionId: proposal.actionId,
      message: `Action Definition "${action.actionDefinitionId}" does not exist in the Ruleset`,
    })
    return
  }

  const occupiedBy = findOccupyingFleet(state, state.submittingPlayerId, proposal.actionId)
  if (occupiedBy !== undefined) {
    addIssue(evaluation, {
      code: "ACTION_ALREADY_IN_PROGRESS",
      actionId: proposal.actionId,
      message: `Action instance "${proposal.actionId}" is still in progress with Fleet "${occupiedBy.id}"`,
    })
  }

  evaluateSelectionFields({ state, proposal, actionDefinition, evaluation })
  reserveProposalStrength({ state, proposal, actionDefinition, evaluation })
  evaluateColonizationEligibility({ state, proposal, actionDefinition, evaluation })
}

export function evaluateSelectionFields({
  state,
  proposal,
  actionDefinition,
  evaluation,
}: {
  state: EligibilityState
  proposal: ProposedSelection
  actionDefinition: ActionDefinition
  evaluation: MutableEvaluation
}): void {
  evaluateTargetFields({ state, proposal, actionDefinition, evaluation })
  evaluateInputFields({ state, proposal, actionDefinition, evaluation })
}

export function evaluateTargetFields({
  state,
  proposal,
  actionDefinition,
  evaluation,
}: {
  state: EligibilityState
  proposal: ProposedSelection
  actionDefinition: ActionDefinition
  evaluation: MutableEvaluation
}): void {
  evaluateMissingTargets({ state, proposal, actionDefinition, evaluation })
  for (const targetTag of Object.keys(proposal.selectedTargets)) {
    evaluateSelectedTarget({ state, proposal, actionDefinition, evaluation }, targetTag)
  }
}
function evaluateMissingTargets({ proposal, actionDefinition, evaluation }: ProposalContext): void {
  for (const targetTag of Object.keys(actionDefinition.targets)) {
    const brandedTargetTag = branded<TargetTag>(targetTag)
    if (getOwnRecordValue(proposal.selectedTargets, targetTag) === undefined) {
      evaluation.missingTargets.push(brandedTargetTag)
      addIssue(evaluation, {
        code: "MISSING_TARGET",
        actionId: proposal.actionId,
        targetTag: brandedTargetTag,
        message: `Choose a value for the "${targetTag}" target`,
      })
    }
  }
}
function evaluateSelectedTarget({ state, proposal, actionDefinition, evaluation }: ProposalContext, targetTag: string): void {
  const brandedTargetTag = branded<TargetTag>(targetTag)
  const targetId = getOwnRecordValue(proposal.selectedTargets, targetTag)
  const targetDefinition = getOwnRecordValue(actionDefinition.targets, targetTag)
  if (targetDefinition === undefined) {
    addIssue(evaluation, {
      code: "UNEXPECTED_TARGET",
      actionId: proposal.actionId,
      targetTag: brandedTargetTag,
      message: `Target tag "${targetTag}" is not defined by this Action`,
    })
    return
  }
  if (targetId === undefined) {
    return
  }

  evaluateTarget({
    state,
    actionId: proposal.actionId,
    targetTag: brandedTargetTag,
    targetId,
    targetDefinition,
    selectedTargets: proposal.selectedTargets,
    evaluation,
  })
}

export function evaluateInputFields({
  state,
  proposal,
  actionDefinition,
  evaluation,
}: {
  state: EligibilityState
  proposal: ProposedSelection
  actionDefinition: ActionDefinition
  evaluation: MutableEvaluation
}): void {
  evaluateMissingInputs({ state, proposal, actionDefinition, evaluation })
  for (const inputTag of Object.keys(proposal.selectedInputs)) {
    evaluateSelectedInput({ state, proposal, actionDefinition, evaluation }, inputTag)
  }
}
function evaluateMissingInputs({ proposal, actionDefinition, evaluation }: ProposalContext): void {
  for (const inputTag of Object.keys(actionDefinition.inputs)) {
    const brandedInputTag = branded<InputTag>(inputTag)
    if (getOwnRecordValue(proposal.selectedInputs, inputTag) === undefined) {
      evaluation.missingInputs.push(brandedInputTag)
      addIssue(evaluation, {
        code: "MISSING_INPUT",
        actionId: proposal.actionId,
        inputTag: brandedInputTag,
        message: `Enter a value for the "${inputTag}" input`,
      })
    }
  }
}
function evaluateSelectedInput({ proposal, actionDefinition, evaluation }: ProposalContext, inputTag: string): void {
  const brandedInputTag = branded<InputTag>(inputTag)
  const inputDefinition = getOwnRecordValue(actionDefinition.inputs, inputTag)
  const value = getOwnRecordValue(proposal.selectedInputs, inputTag)
  if (inputDefinition === undefined) {
    addIssue(evaluation, {
      code: "UNEXPECTED_INPUT",
      actionId: proposal.actionId,
      inputTag: brandedInputTag,
      message: `Input tag "${inputTag}" is not defined by this Action`,
    })
    return
  }
  if (value === undefined) {
    return
  }
  if (inputDefinition.type === "POSITIVE_INTEGER" && !safeTypedParse(PositiveIntegerSchema, value).success) {
    addIssue(evaluation, {
      code: "INVALID_INPUT",
      actionId: proposal.actionId,
      inputTag: brandedInputTag,
      message: `Input "${inputTag}" must be a positive safe integer`,
    })
  }
}

export function reserveProposalStrength({
  state,
  proposal,
  actionDefinition,
  evaluation,
}: {
  state: EligibilityState
  proposal: ProposedSelection
  actionDefinition: ActionDefinition
  evaluation: MutableEvaluation
}): void {
  for (const allocation of proposalStrengthAllocations(state, proposal, actionDefinition)) {
    evaluation.strengthCommitments[allocation.fleetId] = (evaluation.strengthCommitments[allocation.fleetId] ?? 0) + allocation.strength
  }
}

export function evaluateColonizationEligibility({
  state,
  proposal,
  actionDefinition,
  evaluation,
}: {
  state: EligibilityState
  proposal: ProposedSelection
  actionDefinition: ActionDefinition
  evaluation: MutableEvaluation
}): void {
  for (const effectDefinition of actionDefinition.effects.filter(
    (effect): effect is FleetColonizeEffectDefinition => effect.type === FleetColonizeEffectDefinition.type,
  )) {
    evaluateColonizationEffect({ state, proposal, actionDefinition, evaluation, effectDefinition })
  }
}

export function evaluateColonizationEffect({
  state,
  proposal,
  actionDefinition,
  evaluation,
  effectDefinition,
}: {
  state: EligibilityState
  proposal: ProposedSelection
  actionDefinition: ActionDefinition
  evaluation: MutableEvaluation
  effectDefinition: FleetColonizeEffectDefinition
}): void {
  const fleetTag = effectDefinition.targets.fleet.actionTargetTag
  const planetTag = effectDefinition.targets.planet.actionTargetTag
  const fleetId = getOwnRecordValue(proposal.selectedTargets, fleetTag)
  const planetId = getOwnRecordValue(proposal.selectedTargets, planetTag)
  if (fleetId === undefined || planetId === undefined) {
    return
  }
  const fleet = getOwnRecordValue(state.fleets, branded<FleetId>(fleetId))
  const planet = getOwnRecordValue(state.planets, branded<PlanetId>(planetId))
  if (fleet === undefined || planet === undefined) {
    return
  }

  const selectedStrength = selectedColonizingStrength(actionDefinition, effectDefinition, proposal, fleet)
  const eligibility = getFleetColonizationEligibility({
    planetOwnerPlayerId: planet.ownerPlayerId,
    fleetOwnerPlayerId: fleet.ownerPlayerId,
    submittingPlayerId: state.submittingPlayerId,
    fleetStrength: selectedStrength,
    strengthRequirement: effectDefinition.parameters.strengthRequirement,
  })
  if (!eligibility.eligible && eligibility.reason.code === "INSUFFICIENT_STRENGTH") {
    addIssue(evaluation, {
      code: "INSUFFICIENT_STRENGTH",
      actionId: proposal.actionId,
      targetTag: planetTag,
      message: eligibility.reason.message,
    })
  }
}
function selectedColonizingStrength(
  actionDefinition: ActionDefinition,
  effectDefinition: FleetColonizeEffectDefinition,
  proposal: ProposedSelection,
  fleet: Fleet,
): number | undefined {
  const fleetTag = effectDefinition.targets.fleet.actionTargetTag
  const planetTag = effectDefinition.targets.planet.actionTargetTag
  const pairedMove = actionDefinition.effects.find(
    (candidate) =>
      candidate.type === FleetMoveEffectDefinition.type &&
      candidate.targets.fleet.actionTargetTag === fleetTag &&
      candidate.targets.planet.actionTargetTag === planetTag,
  )
  const selectedStrength =
    pairedMove?.type === FleetMoveEffectDefinition.type
      ? getOwnRecordValue(proposal.selectedInputs, pairedMove.inputs.strength.actionInputTag)
      : fleet.strength
  return selectedStrength
}

type ProposalContext = {
  state: EligibilityState
  proposal: ProposedSelection
  actionDefinition: ActionDefinition
  evaluation: MutableEvaluation
}
