import { branded } from "@guillaume-docquier/tools-ts"
import { evaluateTargetCandidate } from "shared/action-submission/evaluateActionSelection.ts"
import type { EligibilityIssueCode, TargetCandidateEvaluation } from "shared/action-submission/selectionEvaluation.ts"
import type { GameId } from "shared/domain/games/GameId.ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import type { createResourcesStub } from "shared/domain/resources/Resources.stub.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import type { ActionDefinitionId } from "shared/domain/ruleset/action-definitions/ActionDefinitionId.ts"
import type { InputTag } from "shared/domain/ruleset/action-definitions/InputTag.ts"
import type { PositiveInteger } from "shared/domain/ruleset/action-definitions/PositiveInteger.ts"
import type { TargetTag } from "shared/domain/ruleset/action-definitions/TargetTag.ts"
import type { TargetId } from "shared/domain/ruleset/target-definitions/TargetId.ts"
import type { Action as CapturedAction } from "shared/domain/turns/actions/Action.ts"
import type { ActionId } from "shared/domain/turns/actions/ActionId.ts"
import type { createFleetStub } from "shared/domain/world/fleets/Fleet.stub.ts"
import type { FleetId } from "shared/domain/world/fleets/FleetId.ts"
import type { PlanetId } from "shared/domain/world/planets/PlanetId.ts"
import { FleetActionSelectionParity } from "shared/testing/FleetActionSelectionParity.ts"
import { expect } from "vitest"
import { createSubmittedActionTargetsDtoStub } from "#api/gameplay/SubmittedActionTargetsDto.stub.ts"
import type { PlayerView, Action, Fleet, Planet } from "#api/types.ts"
import type { AuthenticatedApiClient } from "#tests/ApiClient.ts"
import { ComposedReservationRuleset } from "../fleet-gameplay/gameplay.router.ts"

export async function assertOutOfRangeSubmission({
  player,
  createdGameId,
  playerView,
  standardAction,
  sourceFleet,
  outsideStandardRange,
  destination,
}: AssertOutOfRangeSubmissionInput): Promise<void> {
  const outOfRangeSubmission = player.client.gameplay.updateActionSubmission.mutate({
    gameId: createdGameId,
    turn: playerView.turn,
    submittedActionTargets: createSubmittedActionTargetsDtoStub({
      actionId: standardAction.id,
      selectedTargets: { fleet: sourceFleet.id, planet: outsideStandardRange.id },
      selectedInputs: { strength: FleetActionSelectionParity.standardStrength },
    }),
  })
  await expect(outOfRangeSubmission).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
  const missingForceSubmission = player.client.gameplay.updateActionSubmission.mutate({
    gameId: createdGameId,
    turn: playerView.turn,
    submittedActionTargets: createSubmittedActionTargetsDtoStub({
      actionId: standardAction.id,
      selectedTargets: { fleet: sourceFleet.id, planet: destination.id },
      selectedInputs: {},
    }),
  })
  await expect(missingForceSubmission).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
  const overStrengthSubmission = player.client.gameplay.updateActionSubmission.mutate({
    gameId: createdGameId,
    turn: playerView.turn,
    submittedActionTargets: createSubmittedActionTargetsDtoStub({
      actionId: standardAction.id,
      selectedTargets: { fleet: sourceFleet.id, planet: destination.id },
      selectedInputs: { strength: 51 },
    }),
  })
  await expect(overStrengthSubmission).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })

  // The public DTO accepts only matched target/input objects or a matched null cancellation.
  await expect(
    player.client.gameplay.updateActionSubmission.mutate({
      gameId: createdGameId,
      turn: playerView.turn,
      submittedActionTargets: { actionId: standardAction.id, selectedTargets: null, selectedInputs: {} },
    }),
  ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
  await expect(
    player.client.gameplay.updateActionSubmission.mutate({
      gameId: createdGameId,
      turn: playerView.turn,
      submittedActionTargets: { actionId: standardAction.id, selectedTargets: {}, selectedInputs: null },
    }),
  ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })

  // Exercise positive-safe-integer validation at the HTTP boundary, including JSON's null encoding
  // for non-finite JavaScript numbers.
  for (const invalidStrength of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) {
    await expect(
      player.client.gameplay.updateActionSubmission.mutate({
        gameId: createdGameId,
        turn: playerView.turn,
        submittedActionTargets: {
          actionId: standardAction.id,
          selectedTargets: { fleet: sourceFleet.id, planet: destination.id },
          selectedInputs: { strength: invalidStrength },
        },
      }),
    ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
  }

  const afterRejectedDrafts = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
  expect(afterRejectedDrafts).toStrictEqual(playerView)

  // The API accepts a full unreserved force of 50 and releases its costs when the draft is cancelled.
  await player.client.gameplay.updateActionSubmission.mutate({
    gameId: createdGameId,
    turn: playerView.turn,
    submittedActionTargets: createSubmittedActionTargetsDtoStub({
      actionId: standardAction.id,
      selectedTargets: { fleet: sourceFleet.id, planet: destination.id },
      selectedInputs: { strength: 50 },
    }),
  })
  const fullForceView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
  expect(fullForceView.actions.find(({ id }) => id === standardAction.id)).toMatchObject({
    selectedTargets: { fleet: sourceFleet.id, planet: destination.id },
    selectedInputs: { strength: 50 },
  })
  expect(fullForceView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 6, uncommitted: 3 })
  expect(fullForceView.resources[ResourceType.FUEL]).toStrictEqual({ total: 4, uncommitted: 3 })
}

export type AssertOutOfRangeSubmissionInput = {
  player: AuthenticatedApiClient
  createdGameId: GameId
  playerView: PlayerView
  standardAction: Action
  sourceFleet: Fleet
  outsideStandardRange: Planet
  destination: Planet
}

export async function assertAfterFullForceCancel({
  player,
  createdGameId,
  playerView,
  standardAction,
  improvedAction,
  sourceFleet,
  destination,
  secondStandardAction,
}: AssertAfterFullForceCancelInput): Promise<void> {
  await player.client.gameplay.updateActionSubmission.mutate({
    gameId: createdGameId,
    turn: playerView.turn,
    submittedActionTargets: { actionId: standardAction.id, selectedTargets: null, selectedInputs: null },
  })
  const afterFullForceCancel = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
  expect(afterFullForceCancel.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 6, uncommitted: 6 })
  expect(afterFullForceCancel.resources[ResourceType.FUEL]).toStrictEqual({ total: 4, uncommitted: 4 })

  // Exhaust the action costs while leaving one unallocated Strength; the third draft must fail atomically.
  for (const [action, strength] of [
    [standardAction, 20],
    [improvedAction, 29],
  ] as const) {
    await player.client.gameplay.updateActionSubmission.mutate({
      gameId: createdGameId,
      turn: playerView.turn,
      submittedActionTargets: createSubmittedActionTargetsDtoStub({
        actionId: action.id,
        selectedTargets: { fleet: sourceFleet.id, planet: destination.id },
        selectedInputs: { strength },
      }),
    })
  }
  const beforeThirdCostAttempt = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
  expect(beforeThirdCostAttempt.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 6, uncommitted: 0 })
  expect(beforeThirdCostAttempt.resources[ResourceType.FUEL]).toStrictEqual({ total: 4, uncommitted: 0 })
  expect(beforeThirdCostAttempt.fleets.find(({ id }) => id === sourceFleet.id)?.strength).toBe(50)
  await expect(
    player.client.gameplay.updateActionSubmission.mutate({
      gameId: createdGameId,
      turn: playerView.turn,
      submittedActionTargets: createSubmittedActionTargetsDtoStub({
        actionId: secondStandardAction.id,
        selectedTargets: { fleet: sourceFleet.id, planet: destination.id },
        selectedInputs: { strength: 1 },
      }),
    }),
  ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
  const afterThirdCostAttempt = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
  expect(afterThirdCostAttempt).toStrictEqual(beforeThirdCostAttempt)
  expect(afterThirdCostAttempt.actions.find(({ id }) => id === secondStandardAction.id)).toMatchObject({
    selectedTargets: null,
    selectedInputs: null,
    isInProgress: false,
  })

  for (const action of [standardAction, improvedAction]) {
    await player.client.gameplay.updateActionSubmission.mutate({
      gameId: createdGameId,
      turn: playerView.turn,
      submittedActionTargets: { actionId: action.id, selectedTargets: null, selectedInputs: null },
    })
  }
  const afterCostReservationCancel = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
  expect(afterCostReservationCancel.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 6, uncommitted: 6 })
  expect(afterCostReservationCancel.resources[ResourceType.FUEL]).toStrictEqual({ total: 4, uncommitted: 4 })
}

export type AssertAfterFullForceCancelInput = {
  player: AuthenticatedApiClient
  createdGameId: GameId
  playerView: PlayerView
  standardAction: Action
  improvedAction: Action
  sourceFleet: Fleet
  destination: Planet
  secondStandardAction: Action
}

export async function assertImprovedRangeView({
  player,
  createdGameId,
  playerView,
  improvedAction,
  sourceFleet,
  improvedOnlyDestination,
  destination,
}: AssertImprovedRangeViewInput): Promise<void> {
  await player.client.gameplay.updateActionSubmission.mutate({
    gameId: createdGameId,
    turn: playerView.turn,
    submittedActionTargets: createSubmittedActionTargetsDtoStub({
      actionId: improvedAction.id,
      selectedTargets: { fleet: sourceFleet.id, planet: improvedOnlyDestination.id },
      selectedInputs: { strength: 1 },
    }),
  })
  const improvedRangeView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
  expect(improvedRangeView.actions.find(({ id }) => id === improvedAction.id)).toMatchObject({
    selectedTargets: { fleet: sourceFleet.id, planet: improvedOnlyDestination.id },
    selectedInputs: { strength: 1 },
  })

  // Submit the same semantic vector used by the Storybook and shared resolver tests.
  await player.client.gameplay.updateActionSubmission.mutate({
    gameId: createdGameId,
    turn: playerView.turn,
    submittedActionTargets: createSubmittedActionTargetsDtoStub({
      actionId: improvedAction.id,
      selectedTargets: { fleet: sourceFleet.id, planet: destination.id },
      selectedInputs: { strength: FleetActionSelectionParity.improvedStrength },
    }),
  })
}

export type AssertImprovedRangeViewInput = {
  player: AuthenticatedApiClient
  createdGameId: GameId
  playerView: PlayerView
  improvedAction: Action
  sourceFleet: Fleet
  improvedOnlyDestination: Planet
  destination: Planet
}

export async function assertNormalizedInput({
  retainedView,
  retainedSource,
  origin,
  destination,
  standardAction,
  player,
  createdGameId,
  playerView,
  sourceFleet,
}: AssertNormalizedInputInput): Promise<void> {
  const normalizedInput = {
    resources: {
      total: Object.fromEntries(
        Object.values(ResourceType).map((resourceType) => [resourceType, retainedView.resources[resourceType].total]),
      ),
      uncommitted: Object.fromEntries(
        Object.values(ResourceType).map((resourceType) => [resourceType, retainedView.resources[resourceType].uncommitted]),
      ),
    },
    source: {
      role: "source",
      owner: retainedSource.ownerPlayerId === retainedView.player.id ? "player" : "other",
      strength: retainedSource.strength,
      origin: retainedSource.originPlanetId === origin.id ? "origin" : "other",
      movement: retainedSource.movement ?? null,
    },
    planets: [
      {
        role: "origin",
        owner: origin.ownerPlayerId === retainedView.player.id ? "player" : origin.ownerPlayerId,
        x: origin.x,
        y: origin.y,
      },
      {
        role: "destination",
        owner: destination.ownerPlayerId === null ? null : "other",
        x: destination.x,
        y: destination.y,
      },
    ],
    authorizedActions: retainedView.ruleset.actionPool
      .map(({ id, actionDefinitionId }) => ({ id, actionDefinitionId }))
      .toSorted((first, second) => (first.id < second.id ? -1 : first.id > second.id ? 1 : 0)),
    currentActions: retainedView.actions
      .map(({ id, actionDefinitionId, selectedTargets, selectedInputs, isInProgress }) => ({
        id,
        actionDefinitionId,
        selectedTargets:
          selectedTargets === null
            ? null
            : {
                fleet:
                  selectedTargets[branded<TargetTag>("fleet")] === retainedSource.id
                    ? "source"
                    : selectedTargets[branded<TargetTag>("fleet")],
                planet:
                  selectedTargets[branded<TargetTag>("planet")] === destination.id
                    ? "destination"
                    : selectedTargets[branded<TargetTag>("planet")],
              },
        selectedInputs,
        isInProgress,
      }))
      .toSorted((first, second) => (first.id < second.id ? -1 : first.id > second.id ? 1 : 0)),
    candidate: {
      id: standardAction.id,
      actionDefinitionId: standardAction.actionDefinitionId,
      selectedTargets: { fleet: "source", planet: "destination" },
      selectedInputs: { strength: FleetActionSelectionParity.standardStrength },
    },
  }
  expect(normalizedInput).toStrictEqual(FleetActionSelectionParity.normalizedInput)
  await player.client.gameplay.updateActionSubmission.mutate({
    gameId: createdGameId,
    turn: playerView.turn,
    submittedActionTargets: createSubmittedActionTargetsDtoStub({
      actionId: standardAction.id,
      selectedTargets: { fleet: sourceFleet.id, planet: destination.id },
      selectedInputs: { strength: FleetActionSelectionParity.standardStrength },
    }),
  })
}

export type AssertNormalizedInputInput = {
  retainedView: PlayerView
  retainedSource: Fleet
  origin: Planet
  destination: Planet
  standardAction: Action
  player: AuthenticatedApiClient
  createdGameId: GameId
  playerView: PlayerView
  sourceFleet: Fleet
}

export function assertSelectedView({
  selectedView,
  moveAction,
  sourceFleet,
  destination,
  attackAction,
  evaluatePublicView,
  extraAttackAction,
}: AssertSelectedViewInput): void {
  expect(selectedView.actions.find(({ id }) => id === moveAction.id)).toMatchObject({
    selectedTargets: { fleet: sourceFleet.id, planet: destination.id },
    selectedInputs: { strength: 20 },
  })
  expect(selectedView.actions.find(({ id }) => id === attackAction.id)).toMatchObject({
    selectedTargets: { fleet: sourceFleet.id, planet: destination.id },
    selectedInputs: { strength: 30 },
  })
  expect(selectedView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 8, uncommitted: 0 })
  expect(selectedView.resources[ResourceType.FUEL]).toStrictEqual({ total: 2, uncommitted: 0 })
  const selectedEvaluation = evaluatePublicView(selectedView)

  assertScenarioState({ selectedEvaluation, sourceFleet })

  const partialCandidate = evaluateTargetCandidate({
    state: selectedEvaluation.state,
    ruleset: ComposedReservationRuleset,
    draft: { actionId: extraAttackAction.id, selectedTargets: {}, selectedInputs: {} },
    targetTag: branded<TargetTag>("fleet"),
    targetId: sourceFleet.id,
  })

  assertScenarioState2({ partialCandidate, sourceFleet })
}

export type AssertSelectedViewInput = {
  selectedView: PlayerView
  moveAction: Action
  sourceFleet: Fleet
  destination: Planet
  attackAction: Action
  evaluatePublicView: (view: PlayerView) => {
    state: Readonly<{
      gameId: GameId
      turn: number
      submittingPlayerId: PlayerId
      resources: Readonly<ReturnType<typeof createResourcesStub>>
      players: Readonly<Record<PlayerId, Readonly<{ id: PlayerId; ownerPlayerId: PlayerId }>>>
      planets: Readonly<Record<PlanetId, Readonly<{ id: PlanetId; ownerPlayerId: null | PlayerId; x: number; y: number }>>>
      fleets: Readonly<Record<FleetId, ReturnType<typeof createFleetStub>>>
      actions: readonly CapturedAction[]
    }>
    submissions: Array<
      Readonly<{
        id: ActionId
        playerId: PlayerId
        actionDefinitionId: ActionDefinitionId
        selectedTargets: Readonly<Record<TargetTag, TargetId>>
        selectedInputs: Readonly<Record<InputTag, PositiveInteger>>
      }>
    >
    evaluation: Readonly<{
      status: "ELIGIBLE" | "INCOMPLETE" | "INELIGIBLE"
      issues: ReadonlyArray<
        Readonly<{
          code: EligibilityIssueCode
          actionId?: ActionId
          targetTag?: TargetTag
          inputTag?: InputTag
          resourceType?: ResourceType
          message: string
        }>
      >
      missingTargets: readonly TargetTag[]
      missingInputs: readonly InputTag[]
      resourceCommitments: Readonly<ReturnType<typeof createResourcesStub>>
      strengthCommitments: Readonly<Record<FleetId, number>>
      remainingStrength: Readonly<Record<FleetId, number>>
    }>
  }
  extraAttackAction: Action
}

export function assertScenarioState({ selectedEvaluation, sourceFleet }: AssertScenarioStateInput): void {
  expect({
    status: selectedEvaluation.evaluation.status,
    issues: selectedEvaluation.evaluation.issues,
    strengthCommitment: selectedEvaluation.evaluation.strengthCommitments[sourceFleet.id],
    remainingStrength: selectedEvaluation.evaluation.remainingStrength[sourceFleet.id],
    resourceCommitments: selectedEvaluation.evaluation.resourceCommitments,
  }).toStrictEqual({
    status: "ELIGIBLE",
    issues: [],
    strengthCommitment: 50,
    remainingStrength: 0,
    resourceCommitments: {
      [ResourceType.INFLUENCE]: 8,
      [ResourceType.METAL]: 0,
      [ResourceType.FUEL]: 2,
      [ResourceType.ENERGY]: 0,
      [ResourceType.COLONY]: 0,
    },
  })
}

export type AssertScenarioStateInput = {
  selectedEvaluation: {
    state: Readonly<{
      gameId: GameId
      turn: number
      submittingPlayerId: PlayerId
      resources: Readonly<ReturnType<typeof createResourcesStub>>
      players: Readonly<Record<PlayerId, Readonly<{ id: PlayerId; ownerPlayerId: PlayerId }>>>
      planets: Readonly<Record<PlanetId, Readonly<{ id: PlanetId; ownerPlayerId: null | PlayerId; x: number; y: number }>>>
      fleets: Readonly<Record<FleetId, ReturnType<typeof createFleetStub>>>
      actions: readonly CapturedAction[]
    }>
    submissions: Array<
      Readonly<{
        id: ActionId
        playerId: PlayerId
        actionDefinitionId: ActionDefinitionId
        selectedTargets: Readonly<Record<TargetTag, TargetId>>
        selectedInputs: Readonly<Record<InputTag, PositiveInteger>>
      }>
    >
    evaluation: Readonly<{
      status: "ELIGIBLE" | "INCOMPLETE" | "INELIGIBLE"
      issues: ReadonlyArray<
        Readonly<{
          code: EligibilityIssueCode
          actionId?: ActionId
          targetTag?: TargetTag
          inputTag?: InputTag
          resourceType?: ResourceType
          message: string
        }>
      >
      missingTargets: readonly TargetTag[]
      missingInputs: readonly InputTag[]
      resourceCommitments: Readonly<ReturnType<typeof createResourcesStub>>
      strengthCommitments: Readonly<Record<FleetId, number>>
      remainingStrength: Readonly<Record<FleetId, number>>
    }>
  }
  sourceFleet: Fleet
}

export type AssertScenarioState2Input = {
  partialCandidate: TargetCandidateEvaluation
  sourceFleet: Fleet
}

export type AssertScenarioState3Input = {
  player: AuthenticatedApiClient
  createdGameId: GameId
  selectedView: PlayerView
  attackAction: Action
  sourceFleet: Fleet
  destination: Planet
  buildAction: Action
  origin: Planet
  beforeRejectedDrafts: PlayerView
}

export type AssertScenarioState4Input = { aliceView: PlayerView; source: Fleet; defender: Fleet }

export function assertScenarioState2({ partialCandidate, sourceFleet }: AssertScenarioState2Input): void {
  expect({
    status: partialCandidate.status,
    candidateStatus: partialCandidate.candidateStatus,
    candidateIssues: partialCandidate.candidateIssues.map(({ code }) => code),
    missingTargets: partialCandidate.missingTargets,
    missingInputs: partialCandidate.missingInputs,
    strengthCommitment: partialCandidate.strengthCommitments[sourceFleet.id],
    remainingStrength: partialCandidate.remainingStrength[sourceFleet.id],
    resourceCommitments: partialCandidate.resourceCommitments,
  }).toStrictEqual({
    status: "INELIGIBLE",
    candidateStatus: "INELIGIBLE",
    candidateIssues: ["INSUFFICIENT_STRENGTH"],
    missingTargets: [branded<TargetTag>("planet")],
    missingInputs: [branded("strength")],
    strengthCommitment: 50,
    remainingStrength: 0,
    resourceCommitments: {
      [ResourceType.INFLUENCE]: 13,
      [ResourceType.METAL]: 0,
      [ResourceType.FUEL]: 3,
      [ResourceType.ENERGY]: 0,
      [ResourceType.COLONY]: 0,
    },
  })
}
