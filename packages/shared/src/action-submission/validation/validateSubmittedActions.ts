import { branded } from "@guillaume-docquier/tools-ts"
import type { ReadonlyDeep } from "type-fest"
import { computeAvailableActions } from "#shared/action-submission/computeAvailableActions.ts"
import { evaluateSubmittedActions, type EligibilityState } from "#shared/action-submission/evaluateActionSelection.ts"
import { SubmittedActionIssue } from "#shared/action-submission/validation/SubmittedActionIssue.ts"
import { compareOrdinalStrings } from "#shared/domain/compareOrdinalStrings.ts"
import type { PlayerId } from "#shared/domain/players/PlayerId.ts"
import type { Resources } from "#shared/domain/resources/Resources.ts"
import { ResourceType } from "#shared/domain/resources/ResourceType.ts"
import type { ActionDefinitionId } from "#shared/domain/ruleset/action-definitions/ActionDefinitionId.ts"
import type { Ruleset } from "#shared/domain/ruleset/Ruleset.ts"
import type { SubmittedAction } from "#shared/domain/turns/actions/Action.ts"
import type { ActionId } from "#shared/domain/turns/actions/ActionId.ts"
import type { TurnState } from "#shared/turn-resolution/TurnState.ts"

/**
 * Validates all submitted Actions through the same selection evaluator used by action submission.
 */
export function validateSubmittedActions(
  submittedActions: readonly SubmittedAction[],
  ruleset: Ruleset,
  turnState: ReadonlyDeep<TurnState>,
): Array<ReturnType<typeof SubmittedActionIssue.create>> {
  const submittedById = new Map<ActionId, SubmittedAction>()
  for (const submittedAction of submittedActions) {
    submittedById.set(submittedAction.id, submittedAction)
  }

  const knownActions = new Map(submittedById)
  for (const fleet of Object.values(turnState.fleets)) {
    const movementSubmission = fleet.movement?.submission
    if (movementSubmission !== undefined && !knownActions.has(movementSubmission.id)) {
      knownActions.set(movementSubmission.id, movementSubmission)
    }
  }

  const issues = new Map<string, ReturnType<typeof SubmittedActionIssue.create>>()
  for (const submittedAction of submittedActions) {
    if (Object.hasOwn(ruleset.actionDefinitions, submittedAction.actionDefinitionId)) {
      continue
    }
    const issue = SubmittedActionIssue.create({
      issue: "Action definition does not exist in the Ruleset",
      submittedAction,
      actionDefinitionName: undefined,
    })
    issues.set(`${issue.submittedActionId}|${issue.issue}`, issue)
  }

  const playerIds = [
    ...new Set([
      ...Object.keys(turnState.players),
      ...submittedActions.map(({ playerId }) => playerId),
      ...Object.values(turnState.fleets).flatMap((fleet) => {
        const hasJourneyData = fleet.destinationPlanetId !== undefined || fleet.distanceToEnd !== undefined || fleet.movement !== undefined
        if (!hasJourneyData) {
          return []
        }
        return [fleet.ownerPlayerId, ...(fleet.movement === undefined ? [] : [fleet.movement.submission.playerId])]
      }),
    ]),
  ].toSorted((first, second) => compareOrdinalStrings(first, second))

  for (const playerId of playerIds) {
    // Object.keys widens branded record keys. Include submitted player ids so data from an unknown player is rejected too.
    const brandedPlayerId = branded<PlayerId>(playerId)
    const player = turnState.players[brandedPlayerId]
    const playerSubmissions = submittedActions.filter(
      (submittedAction) =>
        submittedAction.playerId === brandedPlayerId && Object.hasOwn(ruleset.actionDefinitions, submittedAction.actionDefinitionId),
    )
    const playerMovementSubmissions = Object.values(turnState.fleets)
      .flatMap((fleet) => (fleet.movement === undefined ? [] : [fleet.movement.submission]))
      .filter((submission) => submission.playerId === brandedPlayerId)

    if (player === undefined) {
      for (const submittedAction of playerSubmissions) {
        const issue = SubmittedActionIssue.create({
          issue: `Submitting player "${brandedPlayerId}" does not exist in this turn`,
          submittedAction,
          actionDefinitionName: Object.hasOwn(ruleset.actionDefinitions, submittedAction.actionDefinitionId)
            ? ruleset.actionDefinitions[submittedAction.actionDefinitionId]?.name
            : undefined,
        })
        issues.set(`${issue.submittedActionId}|${issue.issue}`, issue)
      }
      for (const submittedAction of playerMovementSubmissions) {
        const issue = SubmittedActionIssue.create({
          issue: `Submitting player "${brandedPlayerId}" does not exist in this turn`,
          submittedAction,
          actionDefinitionName: Object.hasOwn(ruleset.actionDefinitions, submittedAction.actionDefinitionId)
            ? ruleset.actionDefinitions[submittedAction.actionDefinitionId]?.name
            : undefined,
        })
        issues.set(`${issue.submittedActionId}|${issue.issue}`, issue)
      }
    }

    const state = createEligibilityState({
      gameId: turnState.gameId,
      turn: turnState.turn,
      submittingPlayerId: brandedPlayerId,
      resources: player?.resources ?? createEmptyResources(),
      players: turnState.players,
      planets: turnState.planets,
      fleets: turnState.fleets,
      actions: player === undefined ? [] : computeAvailableActions({ playerIds: [brandedPlayerId], ruleset }),
      submittedActions: playerSubmissions,
    })
    const evaluation = evaluateSubmittedActions({ state, ruleset, submissions: playerSubmissions })

    for (const eligibilityIssue of evaluation.issues) {
      const knownSubmittedAction = eligibilityIssue.actionId === undefined ? undefined : knownActions.get(eligibilityIssue.actionId)
      const submittedAction =
        playerSubmissions.find(({ id }) => id === eligibilityIssue.actionId) ??
        playerMovementSubmissions.find(({ id }) => id === eligibilityIssue.actionId) ??
        knownSubmittedAction ??
        playerSubmissions[0] ??
        playerMovementSubmissions[0] ??
        [...knownActions.values()].toSorted((first, second) => compareOrdinalStrings(first.id, second.id))[0] ??
        createUnassociatedSubmittedAction(turnState.turn, brandedPlayerId)
      const actionDefinition = Object.hasOwn(ruleset.actionDefinitions, submittedAction.actionDefinitionId)
        ? ruleset.actionDefinitions[submittedAction.actionDefinitionId]
        : undefined
      const issue = SubmittedActionIssue.create({
        issue:
          eligibilityIssue.code === "ACTION_DEFINITION_MISSING"
            ? "Action definition does not exist in the Ruleset"
            : eligibilityIssue.message,
        submittedAction,
        actionDefinitionName: actionDefinition?.name,
      })
      const key = `${issue.submittedActionId}|${issue.issue}`
      issues.set(key, issue)
    }
  }

  return [...issues.values()].toSorted((first, second) => compareOrdinalStrings(first.submittedActionId, second.submittedActionId))
}

function createEligibilityState({
  gameId,
  turn,
  submittingPlayerId,
  resources,
  players,
  planets,
  fleets,
  actions,
  submittedActions,
}: {
  gameId: TurnState["gameId"]
  turn: TurnState["turn"]
  submittingPlayerId: PlayerId
  resources: TurnState["players"][PlayerId]["resources"]
  players: TurnState["players"]
  planets: TurnState["planets"]
  fleets: TurnState["fleets"]
  actions: ReturnType<typeof computeAvailableActions>
  submittedActions: readonly SubmittedAction[]
}): EligibilityState {
  const submissionsById = new Map<ActionId, SubmittedAction>()
  for (const submittedAction of submittedActions) {
    submissionsById.set(submittedAction.id, submittedAction)
  }

  const currentActions = actions.map((action) => {
    const submission = submissionsById.get(action.id)
    return submission === undefined
      ? action
      : {
          ...action,
          selectedTargets: submission.selectedTargets,
          selectedInputs: submission.selectedInputs,
        }
  })
  const eligiblePlayers = Object.fromEntries(
    Object.keys(players).map((playerId) => {
      const id = branded<PlayerId>(playerId)
      return [id, { id, ownerPlayerId: id }]
    }),
  )
  const eligiblePlanets = Object.fromEntries(
    Object.values(planets).map((planet) => [planet.id, { id: planet.id, ownerPlayerId: planet.ownerPlayerId, x: planet.x, y: planet.y }]),
  )
  const eligibleFleets = Object.fromEntries(Object.values(fleets).map((fleet) => [fleet.id, fleet]))

  return {
    gameId,
    turn,
    submittingPlayerId,
    resources,
    players: eligiblePlayers,
    planets: eligiblePlanets,
    fleets: eligibleFleets,
    actions: currentActions,
  }
}

function createUnassociatedSubmittedAction(turn: number, playerId: PlayerId): SubmittedAction {
  return {
    id: branded<ActionId>(`__VALIDATION_${turn}_${playerId}`),
    playerId,
    actionDefinitionId: branded<ActionDefinitionId>("__UNASSOCIATED_VALIDATION__"),
    selectedTargets: {},
    selectedInputs: {},
  }
}

function createEmptyResources(): Resources {
  return {
    [ResourceType.INFLUENCE]: 0,
    [ResourceType.METAL]: 0,
    [ResourceType.FUEL]: 0,
    [ResourceType.ENERGY]: 0,
    [ResourceType.COLONY]: 0,
  }
}
