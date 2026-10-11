import { branded } from "@guillaume-docquier/tools-ts"
import { safeTypedParse } from "@guillaume-docquier/tools-ts/schemas"
import { compareOrdinalStrings } from "#shared/domain/compareOrdinalStrings.ts"
import type { GameId } from "#shared/domain/games/GameId.ts"
import type { PlayerId } from "#shared/domain/players/PlayerId.ts"
import type { Resources } from "#shared/domain/resources/Resources.ts"
import { ResourceType } from "#shared/domain/resources/ResourceType.ts"
import type { InputTag } from "#shared/domain/ruleset/action-definitions/InputTag.ts"
import { PositiveIntegerSchema } from "#shared/domain/ruleset/action-definitions/PositiveInteger.ts"
import type { TargetTag } from "#shared/domain/ruleset/action-definitions/TargetTag.ts"
import type { EffectDefinition } from "#shared/domain/ruleset/effect-definitions/EffectDefinition.ts"
import { FleetAssaultEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetAssaultEffectDefinition.ts"
import { FleetMoveEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetMoveEffectDefinition.ts"
import type { Ruleset } from "#shared/domain/ruleset/Ruleset.ts"
import { AtFleetPlanetConstraint } from "#shared/domain/ruleset/target-definitions/AtFleetPlanetTargetConstraint.ts"
import { OwnedBySubmittingPlayerConstraint } from "#shared/domain/ruleset/target-definitions/OwnedBySubmittingPlayerTargetConstraint.ts"
import { StationaryFleetConstraint } from "#shared/domain/ruleset/target-definitions/StationaryFleetTargetConstraint.ts"
import type { TargetDefinition } from "#shared/domain/ruleset/target-definitions/TargetDefinition.ts"
import type { TargetId } from "#shared/domain/ruleset/target-definitions/TargetId.ts"
import { TargetType } from "#shared/domain/ruleset/target-definitions/TargetType.ts"
import type { Action, SubmittedAction } from "#shared/domain/turns/actions/Action.ts"
import type { ActionId } from "#shared/domain/turns/actions/ActionId.ts"
import type { Fleet } from "#shared/domain/world/fleets/Fleet.ts"
import { FleetIdSchema, type FleetId } from "#shared/domain/world/fleets/FleetId.ts"
import { isFleetPresentAtPlanet } from "#shared/domain/world/fleets/isFleetPresentAtPlanet.ts"
import { PlanetIdSchema, type PlanetId } from "#shared/domain/world/planets/PlanetId.ts"

function isFleetMoveEffectDefinition(effectDefinition: EffectDefinition): effectDefinition is FleetMoveEffectDefinition {
  return effectDefinition.type === FleetMoveEffectDefinition.type
}

/**
 * A partially completed selection for one authorized Action instance.
 */
export type ActionSelectionDraft = Readonly<{
  actionId: ActionId
  selectedTargets: Readonly<Record<TargetTag, TargetId | undefined>>
  selectedInputs: Readonly<Record<InputTag, number | undefined>>
}>

/**
 * The game state needed to make authoritative Action eligibility decisions for one player.
 */
export type EligibilityState = Readonly<{
  gameId: GameId
  turn: number
  submittingPlayerId: PlayerId
  resources: Readonly<Resources>
  players: Readonly<Record<PlayerId, EligibilityPlayer>>
  planets: Readonly<Record<PlanetId, EligibilityPlanet>>
  fleets: Readonly<Record<FleetId, Fleet>>
  actions: readonly Action[]
}>

/**
 * The location and ownership fields used by shared target evaluation.
 */
export type EligibilityPlanet = Readonly<{
  id: PlanetId
  ownerPlayerId: PlayerId | null
  x: number
  y: number
}>

/**
 * A player target is owned by that player for target-constraint evaluation.
 */
export type EligibilityPlayer = Readonly<{
  id: PlayerId
  ownerPlayerId: PlayerId
}>

/**
 * Stable reasons why a selection can be incomplete or ineligible.
 */
export type EligibilityIssueCode =
  | "ACTION_NOT_AUTHORIZED"
  | "ACTION_DEFINITION_MISSING"
  | "ACTION_DEFINITION_MISMATCH"
  | "SUBMITTING_PLAYER_MISSING"
  | "ACTION_ALREADY_IN_PROGRESS"
  | "DUPLICATE_ACTION"
  | "DUPLICATE_ACTION_OCCUPANCY"
  | "INVALID_MOVEMENT_BINDING"
  | "MISSING_TARGET"
  | "UNEXPECTED_TARGET"
  | "UNKNOWN_TARGET"
  | "TARGET_TYPE_MISMATCH"
  | "TARGET_NOT_OWNED"
  | "FLEET_NOT_STATIONARY"
  | "FLEET_HAS_NO_STRENGTH"
  | "MISSING_INPUT"
  | "UNEXPECTED_INPUT"
  | "INVALID_INPUT"
  | "DEPENDENCY_INCOMPLETE"
  | "DEPENDENCY_INVALID"
  | "MISSING_ORIGIN"
  | "OUT_OF_RANGE"
  | "SAME_AS_ORIGIN"
  | "INSUFFICIENT_STRENGTH"
  | "INSUFFICIENT_RESOURCES"

/**
 * A structured eligibility problem suitable for API errors and player-facing feedback.
 */
export type EligibilityIssue = Readonly<{
  code: EligibilityIssueCode
  actionId?: ActionId
  targetTag?: TargetTag
  inputTag?: InputTag
  resourceType?: ResourceType
  message: string
}>

/**
 * The eligibility and allocation result shared by the UI, API, and turn resolver.
 */
export type SelectionEvaluation = Readonly<{
  status: "ELIGIBLE" | "INCOMPLETE" | "INELIGIBLE"
  issues: readonly EligibilityIssue[]
  missingTargets: readonly TargetTag[]
  missingInputs: readonly InputTag[]
  resourceCommitments: Readonly<Resources>
  strengthCommitments: Readonly<Record<FleetId, number>>
  remainingStrength: Readonly<Record<FleetId, number>>
}>

/**
 * Candidate-specific status returned when the caller is building target choices.
 */
export type TargetCandidateEvaluation = SelectionEvaluation &
  Readonly<{
    candidateStatus: "ELIGIBLE" | "INCOMPLETE" | "INELIGIBLE"
    candidateIssues: readonly EligibilityIssue[]
  }>

type ProposedSelection = Readonly<{
  actionId: ActionId
  selectedTargets: Readonly<Record<string, TargetId | undefined>>
  selectedInputs: Readonly<Record<string, number | undefined>>
}>

type MutableEvaluation = {
  issues: EligibilityIssue[]
  missingTargets: TargetTag[]
  missingInputs: InputTag[]
  resourceCommitments: Resources
  strengthCommitments: Record<FleetId, number>
}

/**
 * Evaluates a draft as a replacement for that Action instance's current submission.
 */
export function evaluateActionSelection({
  state,
  ruleset,
  draft,
}: {
  state: EligibilityState
  ruleset: Ruleset
  draft: ActionSelectionDraft
}): SelectionEvaluation {
  const currentSelections = state.actions.flatMap((action) =>
    action.playerId === state.submittingPlayerId && action.selectedTargets !== null && action.id !== draft.actionId
      ? [submittedActionToProposal(action)]
      : [],
  )

  return evaluateProposals({
    state,
    ruleset,
    proposals: [...currentSelections, draftToProposal(draft)],
  })
}

/**
 * Evaluates one candidate target by substituting it into the same full selection evaluator.
 */
export function evaluateTargetCandidate({
  state,
  ruleset,
  draft,
  targetTag,
  targetId,
}: {
  state: EligibilityState
  ruleset: Ruleset
  draft: ActionSelectionDraft
  targetTag: TargetTag
  targetId: TargetId
}): TargetCandidateEvaluation {
  const evaluation = evaluateActionSelection({
    state,
    ruleset,
    draft: {
      ...draft,
      selectedTargets: { ...draft.selectedTargets, [targetTag]: targetId },
    },
  })
  const candidateIssues = evaluation.issues.filter((issue) => issue.actionId === draft.actionId && issue.targetTag === targetTag)
  const action = state.actions.find(({ id }) => id === draft.actionId)
  const actionDefinition = action === undefined ? undefined : getOwnRecordValue(ruleset.actionDefinitions, action.actionDefinitionId)
  const movementEffect = actionDefinition?.effects.find(isFleetMoveEffectDefinition)
  if (
    movementEffect !== undefined &&
    targetTag === movementEffect.targets.fleet.actionTargetTag &&
    getOwnRecordValue(draft.selectedInputs, movementEffect.inputs.strength.actionInputTag) === undefined &&
    evaluation.remainingStrength[branded<FleetId>(targetId)] === 0 &&
    getStatus(candidateIssues) !== "INELIGIBLE"
  ) {
    candidateIssues.push({
      code: "INSUFFICIENT_STRENGTH",
      actionId: draft.actionId,
      targetTag,
      inputTag: movementEffect.inputs.strength.actionInputTag,
      message: "No uncommitted Strength remains on the selected Fleet",
    })
  }
  const candidateStatus = getStatus(candidateIssues)

  return { ...evaluation, candidateStatus, candidateIssues }
}

/**
 * Evaluates the complete set of submitted Actions against one player's full current state.
 */
export function evaluateSubmittedActions({
  state,
  ruleset,
  submissions,
}: {
  state: EligibilityState
  ruleset: Ruleset
  submissions: readonly SubmittedAction[]
}): SelectionEvaluation {
  const duplicateIds = findDuplicates(submissions.map(({ id }) => id))
  const proposals = submissions.map(submittedActionToProposal)
  const evaluation = evaluateProposals({ state, ruleset, proposals })
  const definitionMismatches = submissions.flatMap((submission) => {
    const authorizedAction = state.actions.find(({ id }) => id === submission.id)
    if (authorizedAction === undefined || authorizedAction.actionDefinitionId === submission.actionDefinitionId) {
      return []
    }
    return [
      {
        code: "ACTION_DEFINITION_MISMATCH" as const,
        actionId: submission.id,
        message: `Action instance "${submission.id}" is bound to "${authorizedAction.actionDefinitionId}", not "${submission.actionDefinitionId}"`,
      },
    ]
  })
  if (duplicateIds.length === 0 && definitionMismatches.length === 0) {
    return evaluation
  }

  return {
    ...evaluation,
    status: "INELIGIBLE",
    issues: [
      ...evaluation.issues,
      ...definitionMismatches,
      ...duplicateIds.map((actionId) => ({
        code: "DUPLICATE_ACTION" as const,
        actionId,
        message: `Action instance "${actionId}" was submitted more than once`,
      })),
    ].toSorted(compareIssues),
  }
}

function evaluateProposals({
  state,
  ruleset,
  proposals,
}: {
  state: EligibilityState
  ruleset: Ruleset
  proposals: readonly ProposedSelection[]
}): SelectionEvaluation {
  const evaluation: MutableEvaluation = {
    issues: [],
    missingTargets: [],
    missingInputs: [],
    resourceCommitments: createZeroResources(),
    strengthCommitments: {},
  }
  const authorizedActions = new Map<ActionId, Action>()

  for (const action of state.actions) {
    if (action.playerId !== state.submittingPlayerId || authorizedActions.has(action.id)) {
      continue
    }
    authorizedActions.set(action.id, action)
  }

  validateMovementOccupancy({ state, ruleset, evaluation })

  const sortedProposals = proposals.toSorted((first, second) => compareOrdinalStrings(first.actionId, second.actionId))
  for (const proposal of sortedProposals) {
    evaluateProposal({ state, ruleset, proposal, authorizedActions, evaluation })
  }

  evaluateResourceBudget(state, sortedProposals, authorizedActions, ruleset, evaluation)
  evaluateStrengthBudget(state, sortedProposals, authorizedActions, ruleset, evaluation)

  const issues = evaluation.issues.toSorted(compareIssues)
  return {
    status: getStatus(issues),
    issues,
    missingTargets: uniqueSorted(evaluation.missingTargets),
    missingInputs: uniqueSorted(evaluation.missingInputs),
    resourceCommitments: evaluation.resourceCommitments,
    strengthCommitments: evaluation.strengthCommitments,
    remainingStrength: computeRemainingStrength(state, evaluation.strengthCommitments),
  }
}

function evaluateProposal({
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

  for (const targetTag of Object.keys(proposal.selectedTargets)) {
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
      continue
    }
    if (targetId === undefined) {
      continue
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

  for (const inputTag of Object.keys(proposal.selectedInputs)) {
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
      continue
    }
    if (value === undefined) {
      continue
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

  for (const effectDefinition of actionDefinition.effects) {
    if (effectDefinition.type !== FleetMoveEffectDefinition.type) {
      continue
    }
    const fleetTag = effectDefinition.targets.fleet.actionTargetTag
    const selectedFleetId = getOwnRecordValue(proposal.selectedTargets, fleetTag)
    const forceTag = effectDefinition.inputs.strength.actionInputTag
    const selectedStrength = getOwnRecordValue(proposal.selectedInputs, forceTag)
    if (selectedFleetId === undefined || selectedStrength === undefined) {
      continue
    }

    const fleet = getOwnRecordValue(state.fleets, branded<FleetId>(selectedFleetId))
    if (fleet === undefined) {
      continue
    }
    if (safeTypedParse(PositiveIntegerSchema, selectedStrength).success) {
      evaluation.strengthCommitments[fleet.id] = (evaluation.strengthCommitments[fleet.id] ?? 0) + selectedStrength
    }
  }
}

function evaluateTarget({
  state,
  actionId,
  targetTag,
  targetId,
  targetDefinition,
  selectedTargets,
  evaluation,
}: {
  state: EligibilityState
  actionId: ActionId
  targetTag: TargetTag
  targetId: TargetId
  targetDefinition: TargetDefinition
  selectedTargets: Readonly<Record<string, TargetId | undefined>>
  evaluation: MutableEvaluation
}): void {
  const target = getTargetEntity(state, targetDefinition.targetType, targetId)
  if (target === undefined) {
    const anotherType = getTargetType(state, targetId)
    addIssue(evaluation, {
      code: anotherType === undefined ? "UNKNOWN_TARGET" : "TARGET_TYPE_MISMATCH",
      actionId,
      targetTag,
      message:
        anotherType === undefined
          ? `Target "${targetId}" does not exist in this game`
          : `Target "${targetId}" is ${anotherType}, but the "${targetTag}" slot requires ${targetDefinition.targetType}`,
    })
    return
  }

  for (const constraint of targetDefinition.constraints) {
    switch (constraint.type) {
      case OwnedBySubmittingPlayerConstraint.type:
        if (target.ownerPlayerId !== state.submittingPlayerId) {
          addIssue(evaluation, {
            code: "TARGET_NOT_OWNED",
            actionId,
            targetTag,
            message: `Target "${targetId}" must be owned by the submitting player`,
          })
        }
        break
      case StationaryFleetConstraint.type:
        {
          const fleet = getOwnRecordValue(state.fleets, branded<FleetId>(targetId))
          if (
            fleet !== undefined &&
            (fleet.movement !== undefined || fleet.destinationPlanetId !== undefined || fleet.distanceToEnd !== undefined)
          ) {
            addIssue(evaluation, {
              code: "FLEET_NOT_STATIONARY",
              actionId,
              targetTag,
              message: `Fleet "${targetId}" is already in transit`,
            })
          } else if (fleet !== undefined && fleet.strength <= 0) {
            addIssue(evaluation, {
              code: "FLEET_HAS_NO_STRENGTH",
              actionId,
              targetTag,
              message: `Fleet "${targetId}" has no available Strength`,
            })
          }
        }
        break
      case "WITHIN_FLEET_RANGE": {
        const sourceFleetTag = constraint.references.sourceFleetTag
        const sourceFleetId = getOwnRecordValue(selectedTargets, sourceFleetTag)
        if (sourceFleetId === undefined) {
          addIssue(evaluation, {
            code: "DEPENDENCY_INCOMPLETE",
            actionId,
            targetTag,
            message: `Choose source Fleet "${sourceFleetTag}" before choosing this destination`,
          })
          break
        }
        const sourceFleet = getOwnRecordValue(state.fleets, branded<FleetId>(sourceFleetId))
        if (sourceFleet === undefined) {
          addIssue(evaluation, {
            code: "DEPENDENCY_INVALID",
            actionId,
            targetTag,
            message: `Source Fleet "${sourceFleetId}" is unavailable for this destination`,
          })
          break
        }
        const origin = getOwnRecordValue(state.planets, sourceFleet.originPlanetId)
        if (origin === undefined) {
          addIssue(evaluation, {
            code: "MISSING_ORIGIN",
            actionId,
            targetTag,
            message: `Source Fleet "${sourceFleetId}" has no known origin Planet`,
          })
          break
        }
        const destination = getOwnRecordValue(state.planets, branded<PlanetId>(targetId))
        if (destination === undefined) {
          addIssue(evaluation, {
            code: "TARGET_TYPE_MISMATCH",
            actionId,
            targetTag,
            message: `Target "${targetId}" is not a Planet`,
          })
          break
        }
        const distance = Math.hypot(destination.x - origin.x, destination.y - origin.y)
        if (!Number.isFinite(distance) || distance > constraint.parameters.maxDistance) {
          addIssue(evaluation, {
            code: "OUT_OF_RANGE",
            actionId,
            targetTag,
            message: `Planet "${targetId}" is outside this Fleet's maximum range of ${constraint.parameters.maxDistance} light-years`,
          })
        }
        break
      }
      case AtFleetPlanetConstraint.type: {
        const sourceFleetTag = constraint.references.sourceFleetTag
        const sourceFleetId = getOwnRecordValue(selectedTargets, sourceFleetTag)
        if (sourceFleetId === undefined) {
          addIssue(evaluation, {
            code: "DEPENDENCY_INCOMPLETE",
            actionId,
            targetTag,
            message: `Choose source Fleet "${sourceFleetTag}" before choosing this Planet`,
          })
          break
        }
        const sourceFleet = getOwnRecordValue(state.fleets, branded<FleetId>(sourceFleetId))
        if (sourceFleet === undefined) {
          addIssue(evaluation, {
            code: "DEPENDENCY_INVALID",
            actionId,
            targetTag,
            message: `Source Fleet "${sourceFleetId}" is unavailable for this Planet`,
          })
        } else if (!isFleetPresentAtPlanet(sourceFleet, branded<PlanetId>(targetId))) {
          addIssue(evaluation, {
            code: "DEPENDENCY_INVALID",
            actionId,
            targetTag,
            message: `Planet "${targetId}" must be the selected Fleet's current stationary location`,
          })
        }
        break
      }
      case "DIFFERENT_FROM_FLEET_ORIGIN": {
        const sourceFleetTag = constraint.references.sourceFleetTag
        const sourceFleetId = getOwnRecordValue(selectedTargets, sourceFleetTag)
        if (sourceFleetId === undefined) {
          addIssue(evaluation, {
            code: "DEPENDENCY_INCOMPLETE",
            actionId,
            targetTag,
            message: `Choose source Fleet "${sourceFleetTag}" before choosing this destination`,
          })
          break
        }
        const sourceFleet = getOwnRecordValue(state.fleets, branded<FleetId>(sourceFleetId))
        if (sourceFleet === undefined) {
          addIssue(evaluation, {
            code: "DEPENDENCY_INVALID",
            actionId,
            targetTag,
            message: `Source Fleet "${sourceFleetId}" is unavailable for this destination`,
          })
        } else if (sourceFleet.originPlanetId === targetId) {
          addIssue(evaluation, {
            code: "SAME_AS_ORIGIN",
            actionId,
            targetTag,
            message: "Choose a destination Planet other than the Fleet's current Planet",
          })
        }
        break
      }
    }
  }
}

function evaluateResourceBudget(
  state: EligibilityState,
  proposals: readonly ProposedSelection[],
  authorizedActions: ReadonlyMap<ActionId, Action>,
  ruleset: Ruleset,
  evaluation: MutableEvaluation,
): void {
  const running = createZeroResources()
  for (const proposal of proposals) {
    const action = authorizedActions.get(proposal.actionId)
    const definition = action === undefined ? undefined : getOwnRecordValue(ruleset.actionDefinitions, action.actionDefinitionId)
    if (definition === undefined) {
      continue
    }

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
}

function evaluateStrengthBudget(
  state: EligibilityState,
  proposals: readonly ProposedSelection[],
  authorizedActions: ReadonlyMap<ActionId, Action>,
  ruleset: Ruleset,
  evaluation: MutableEvaluation,
): void {
  const allocationsByFleet = new Map<
    FleetId,
    Array<{
      actionId: ActionId
      targetTag: TargetTag
      inputTag: InputTag
      strength: number
    }>
  >()

  for (const proposal of proposals) {
    const action = authorizedActions.get(proposal.actionId)
    const definition = action === undefined ? undefined : getOwnRecordValue(ruleset.actionDefinitions, action.actionDefinitionId)
    if (definition === undefined) {
      continue
    }

    for (const effectDefinition of definition.effects) {
      if (effectDefinition.type !== FleetMoveEffectDefinition.type) {
        continue
      }
      const fleetId = getOwnRecordValue(proposal.selectedTargets, effectDefinition.targets.fleet.actionTargetTag)
      const strength = getOwnRecordValue(proposal.selectedInputs, effectDefinition.inputs.strength.actionInputTag)
      if (fleetId === undefined || strength === undefined || !safeTypedParse(PositiveIntegerSchema, strength).success) {
        continue
      }
      const brandedFleetId = branded<FleetId>(fleetId)
      if (getOwnRecordValue(state.fleets, brandedFleetId) === undefined) {
        continue
      }
      allocationsByFleet.set(brandedFleetId, [
        ...(allocationsByFleet.get(brandedFleetId) ?? []),
        {
          actionId: proposal.actionId,
          targetTag: effectDefinition.targets.fleet.actionTargetTag,
          inputTag: effectDefinition.inputs.strength.actionInputTag,
          strength,
        },
      ])
    }
  }

  for (const [fleetId, allocations] of allocationsByFleet) {
    const fleet = getOwnRecordValue(state.fleets, fleetId)
    if (fleet === undefined) {
      continue
    }
    const totalReserved = allocations.reduce((total, allocation) => total + allocation.strength, 0)
    if (totalReserved <= fleet.strength) {
      continue
    }
    for (const allocation of allocations) {
      addIssue(evaluation, {
        code: "INSUFFICIENT_STRENGTH",
        actionId: allocation.actionId,
        targetTag: allocation.targetTag,
        inputTag: allocation.inputTag,
        message: "The selected Fleet has " + fleet.strength + " Strength, but submitted Actions reserve " + totalReserved,
      })
    }
  }
}
function validateMovementOccupancy({
  state,
  ruleset,
  evaluation,
}: {
  state: EligibilityState
  ruleset: Ruleset
  evaluation: MutableEvaluation
}): void {
  const occupancy = new Map<ActionId, Fleet[]>()
  for (const fleet of Object.values(state.fleets).toSorted((first, second) => compareOrdinalStrings(first.id, second.id))) {
    const movement = fleet.movement
    const hasJourneyData = fleet.destinationPlanetId !== undefined || fleet.distanceToEnd !== undefined || movement !== undefined
    if (!hasJourneyData) {
      continue
    }
    if (fleet.destinationPlanetId === undefined || fleet.distanceToEnd === undefined || movement === undefined) {
      addIssue(evaluation, {
        code: "INVALID_MOVEMENT_BINDING",
        ...(movement === undefined ? {} : { actionId: movement.submission.id }),
        message: `Fleet "${fleet.id}" has incomplete in-progress movement data`,
      })
      continue
    }

    const poolEntry = ruleset.actionPool.find(({ id }) => id === movement.submission.id)
    const definition = poolEntry === undefined ? undefined : getOwnRecordValue(ruleset.actionDefinitions, poolEntry.actionDefinitionId)
    const moveEffects = definition?.effects.filter(isFleetMoveEffectDefinition) ?? []
    const moveEffect = moveEffects.length === 1 ? moveEffects[0] : undefined
    const expectedPendingArrivalEffects =
      definition === undefined
        ? []
        : [...definition.costs, ...definition.effects].flatMap((effectDefinition, definitionOrdinal) =>
            effectDefinition.type === FleetAssaultEffectDefinition.type ? [{ effectDefinition, definitionOrdinal }] : [],
          )
    const fleetTargetTag = moveEffect?.targets.fleet.actionTargetTag
    const planetTargetTag = moveEffect?.targets.planet.actionTargetTag
    const strengthInputTag = moveEffect?.inputs.strength.actionInputTag
    const selectedFleetId =
      fleetTargetTag === undefined ? undefined : getOwnRecordValue(movement.submission.selectedTargets, fleetTargetTag)
    const selectedPlanetId =
      planetTargetTag === undefined ? undefined : getOwnRecordValue(movement.submission.selectedTargets, planetTargetTag)
    const selectedStrength =
      strengthInputTag === undefined ? undefined : getOwnRecordValue(movement.submission.selectedInputs, strengthInputTag)
    const fleetTargetDefinition = fleetTargetTag === undefined ? undefined : getOwnRecordValue(definition?.targets ?? {}, fleetTargetTag)
    const planetTargetDefinition = planetTargetTag === undefined ? undefined : getOwnRecordValue(definition?.targets ?? {}, planetTargetTag)
    const strengthInputDefinition =
      strengthInputTag === undefined ? undefined : getOwnRecordValue(definition?.inputs ?? {}, strengthInputTag)
    const parsedFleetId = selectedFleetId === undefined ? undefined : safeTypedParse(FleetIdSchema, selectedFleetId)
    const parsedPlanetId = selectedPlanetId === undefined ? undefined : safeTypedParse(PlanetIdSchema, selectedPlanetId)
    const parsedStrength = selectedStrength === undefined ? undefined : safeTypedParse(PositiveIntegerSchema, selectedStrength)
    const selectionsMatchDefinition =
      definition !== undefined &&
      Object.keys(definition.targets).every((tag) => Object.hasOwn(movement.submission.selectedTargets, tag)) &&
      Object.keys(movement.submission.selectedTargets).every((tag) => Object.hasOwn(definition.targets, tag)) &&
      Object.keys(definition.inputs).every((tag) => Object.hasOwn(movement.submission.selectedInputs, tag)) &&
      Object.keys(movement.submission.selectedInputs).every((tag) => Object.hasOwn(definition.inputs, tag)) &&
      Object.values(movement.submission.selectedTargets).every((value) => value !== undefined) &&
      Object.values(movement.submission.selectedInputs).every((value) => value !== undefined)
    const pendingArrivalBindingMatches =
      movement.pendingArrivalEffects.length === expectedPendingArrivalEffects.length &&
      movement.pendingArrivalEffects.every((pending, index) => {
        const expected = expectedPendingArrivalEffects[index]
        return (
          expected !== undefined &&
          pending.definitionOrdinal === expected.definitionOrdinal &&
          pending.effectDefinition.targets.fleet.actionTargetTag === expected.effectDefinition.targets.fleet.actionTargetTag &&
          pending.effectDefinition.targets.planet.actionTargetTag === expected.effectDefinition.targets.planet.actionTargetTag &&
          selectedFleetId ===
            getOwnRecordValue(movement.submission.selectedTargets, pending.effectDefinition.targets.fleet.actionTargetTag) &&
          selectedPlanetId ===
            getOwnRecordValue(movement.submission.selectedTargets, pending.effectDefinition.targets.planet.actionTargetTag)
        )
      })
    const hasValidJourneyBinding =
      pendingArrivalBindingMatches &&
      fleet.ownerPlayerId === movement.submission.playerId &&
      poolEntry !== undefined &&
      poolEntry.actionDefinitionId === movement.submission.actionDefinitionId &&
      moveEffect !== undefined &&
      fleetTargetDefinition?.targetType === TargetType.FLEET &&
      planetTargetDefinition?.targetType === TargetType.PLANET &&
      strengthInputDefinition?.type === "POSITIVE_INTEGER" &&
      selectionsMatchDefinition &&
      parsedFleetId?.success === true &&
      parsedPlanetId?.success === true &&
      parsedPlanetId.data === fleet.destinationPlanetId &&
      getOwnRecordValue(state.planets, parsedPlanetId.data) !== undefined &&
      parsedStrength?.success === true &&
      selectedStrength !== undefined &&
      Number(selectedStrength) === Number(fleet.strength) &&
      movement.departureTurn <= state.turn

    if (!hasValidJourneyBinding) {
      addIssue(evaluation, {
        code: "INVALID_MOVEMENT_BINDING",
        actionId: movement.submission.id,
        message: "Fleet " + fleet.id + " has an invalid in-progress Action binding",
      })
    }
    if (fleet.ownerPlayerId !== state.submittingPlayerId) {
      continue
    }
    occupancy.set(movement.submission.id, [...(occupancy.get(movement.submission.id) ?? []), fleet])
  }

  for (const [actionId, fleets] of occupancy) {
    if (fleets.length > 1) {
      addIssue(evaluation, {
        code: "DUPLICATE_ACTION_OCCUPANCY",
        actionId,
        message: `More than one in-transit Fleet occupies Action instance "${actionId}"`,
      })
    }
  }
}

function findOccupyingFleet(state: EligibilityState, playerId: PlayerId, actionId: ActionId): Fleet | undefined {
  return Object.values(state.fleets)
    .filter((fleet) => fleet.ownerPlayerId === playerId && fleet.movement?.submission.id === actionId)
    .toSorted((first, second) => compareOrdinalStrings(first.id, second.id))[0]
}

function getTargetEntity(
  state: EligibilityState,
  targetType: TargetType,
  targetId: TargetId,
): ({ type: "PLANET" } & EligibilityPlanet) | ({ type: "FLEET" } & Fleet) | ({ type: "PLAYER" } & EligibilityPlayer) | undefined {
  switch (targetType) {
    case TargetType.PLANET: {
      const planet = getOwnRecordValue(state.planets, branded<PlanetId>(targetId))
      return planet === undefined ? undefined : { ...planet, type: TargetType.PLANET }
    }
    case TargetType.FLEET: {
      const fleet = getOwnRecordValue(state.fleets, branded<FleetId>(targetId))
      return fleet === undefined ? undefined : { ...fleet, type: TargetType.FLEET }
    }
    case TargetType.PLAYER: {
      const playerId = branded<PlayerId>(targetId)
      const player = getOwnRecordValue(state.players, playerId)
      return player === undefined ? undefined : { ...player, type: TargetType.PLAYER }
    }
  }
}

function getTargetType(state: EligibilityState, targetId: TargetId): TargetType | undefined {
  if (getOwnRecordValue(state.planets, branded<PlanetId>(targetId)) !== undefined) {
    return TargetType.PLANET
  }
  if (getOwnRecordValue(state.fleets, branded<FleetId>(targetId)) !== undefined) {
    return TargetType.FLEET
  }
  if (getOwnRecordValue(state.players, branded<PlayerId>(targetId)) !== undefined) {
    return TargetType.PLAYER
  }
  return undefined
}

function computeRemainingStrength(state: EligibilityState, commitments: Readonly<Record<FleetId, number>>): Record<FleetId, number> {
  const remaining: Record<FleetId, number> = {}
  for (const fleet of Object.values(state.fleets).toSorted((first, second) => compareOrdinalStrings(first.id, second.id))) {
    remaining[fleet.id] =
      fleet.ownerPlayerId !== state.submittingPlayerId || fleet.movement !== undefined
        ? 0
        : Math.max(0, fleet.strength - (commitments[fleet.id] ?? 0))
  }
  return remaining
}

function createZeroResources(): Resources {
  return {
    [ResourceType.INFLUENCE]: 0,
    [ResourceType.METAL]: 0,
    [ResourceType.FUEL]: 0,
    [ResourceType.ENERGY]: 0,
    [ResourceType.COLONY]: 0,
  }
}

function getOwnRecordValue<TKey extends string, TValue>(record: Readonly<Record<TKey, TValue>>, key: string): TValue | undefined {
  if (!Object.hasOwn(record, key)) {
    return undefined
  }
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- SAFETY: The own-property check proves key is a key of record.
  return record[key as TKey]
}

function draftToProposal(draft: ActionSelectionDraft): ProposedSelection {
  return {
    actionId: draft.actionId,
    selectedTargets: draft.selectedTargets,
    selectedInputs: draft.selectedInputs,
  }
}

function submittedActionToProposal(submittedAction: SubmittedAction): ProposedSelection {
  return {
    actionId: submittedAction.id,
    selectedTargets: submittedAction.selectedTargets,
    selectedInputs: submittedAction.selectedInputs,
  }
}

function findDuplicates(values: readonly ActionId[]): ActionId[] {
  const seen = new Set<ActionId>()
  const duplicates = new Set<ActionId>()
  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value)
    }
    seen.add(value)
  }
  return [...duplicates].toSorted((first, second) => compareOrdinalStrings(first, second))
}

function addIssue(evaluation: MutableEvaluation, issue: EligibilityIssue): void {
  evaluation.issues.push(issue)
}

function getStatus(issues: readonly EligibilityIssue[]): SelectionEvaluation["status"] {
  if (issues.some((issue) => issue.code !== "MISSING_TARGET" && issue.code !== "MISSING_INPUT" && issue.code !== "DEPENDENCY_INCOMPLETE")) {
    return "INELIGIBLE"
  }
  return issues.length === 0 ? "ELIGIBLE" : "INCOMPLETE"
}

function compareIssues(first: EligibilityIssue, second: EligibilityIssue): number {
  const actionOrder = compareOrdinalStrings(first.actionId ?? "", second.actionId ?? "")
  if (actionOrder !== 0) {
    return actionOrder
  }
  const codeOrder = compareOrdinalStrings(first.code, second.code)
  if (codeOrder !== 0) {
    return codeOrder
  }
  const targetTagOrder = compareOrdinalStrings(first.targetTag ?? "", second.targetTag ?? "")
  if (targetTagOrder !== 0) {
    return targetTagOrder
  }
  const inputTagOrder = compareOrdinalStrings(first.inputTag ?? "", second.inputTag ?? "")
  if (inputTagOrder !== 0) {
    return inputTagOrder
  }
  const resourceOrder =
    (first.resourceType === undefined ? -1 : Object.values(ResourceType).indexOf(first.resourceType)) -
    (second.resourceType === undefined ? -1 : Object.values(ResourceType).indexOf(second.resourceType))
  return resourceOrder !== 0 ? resourceOrder : compareOrdinalStrings(first.message, second.message)
}

function uniqueSorted<T extends string>(values: readonly T[]): T[] {
  return [...new Set(values)].toSorted((first, second) => compareOrdinalStrings(first, second))
}
