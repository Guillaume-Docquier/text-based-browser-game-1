import { branded } from "@guillaume-docquier/tools-ts"
import { evaluateTargetCandidate } from "shared/action-submission/evaluateActionSelection.ts"
import type { EligibilityIssueCode, TargetCandidateEvaluation } from "shared/action-submission/selectionEvaluation.ts"
import { compareOrdinalStrings } from "shared/domain/compareOrdinalStrings.ts"
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
import { required } from "shared/testing/required.ts"
import { expect } from "vitest"
import { createSubmittedActionTargetsDtoStub } from "#api/gameplay/SubmittedActionTargetsDto.stub.ts"
import type { PlayerView, Action, Fleet, Planet } from "#api/types.ts"
import type { AuthenticatedApiClient } from "#tests/ApiClient.ts"
import { ComposedReservationRuleset } from "../fleet-gameplay/gameplay.router.ts"

export async function assertOutOfRangeSubmission(input: AssertOutOfRangeSubmissionInput): Promise<void> {
  await verifyOutOfRangeSubmission({ ...input })

  await verifyOverStrengthSubmission({ ...input })

  // Exercise positive-safe-integer validation at the HTTP boundary, including JSON's null encoding
  // for non-finite JavaScript numbers.

  await verifyAfterRejectedDrafts({ ...input })
  const fullForceView = await input.player.client.gameplay.getPlayerView.query({ gameId: input.createdGameId })
  expect(fullForceView.actions.find(({ id }) => id === input.standardAction.id)).toMatchObject({
    selectedTargets: { fleet: input.sourceFleet.id, planet: input.destination.id },
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

export async function assertAfterFullForceCancel(input: AssertAfterFullForceCancelInput): Promise<void> {
  await verifyAfterFullForceCancel({ ...input })

  await verifyBeforeThirdCostAttempt({ ...input })

  for (const action of [input.standardAction, input.improvedAction]) {
    await input.player.client.gameplay.updateActionSubmission.mutate({
      gameId: input.createdGameId,
      turn: input.playerView.turn,
      submittedActionTargets: { actionId: action.id, selectedTargets: null, selectedInputs: null },
    })
  }
  const afterCostReservationCancel = await input.player.client.gameplay.getPlayerView.query({ gameId: input.createdGameId })
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

export async function assertImprovedRangeView(input: AssertImprovedRangeViewInput): Promise<void> {
  await input.player.client.gameplay.updateActionSubmission.mutate({
    gameId: input.createdGameId,
    turn: input.playerView.turn,
    submittedActionTargets: createSubmittedActionTargetsDtoStub({
      actionId: input.improvedAction.id,
      selectedTargets: { fleet: input.sourceFleet.id, planet: input.improvedOnlyDestination.id },
      selectedInputs: { strength: 1 },
    }),
  })
  const improvedRangeView = await input.player.client.gameplay.getPlayerView.query({ gameId: input.createdGameId })
  expect(improvedRangeView.actions.find(({ id }) => id === input.improvedAction.id)).toMatchObject({
    selectedTargets: { fleet: input.sourceFleet.id, planet: input.improvedOnlyDestination.id },
    selectedInputs: { strength: 1 },
  })

  // Submit the same semantic vector used by the Storybook and shared resolver tests.
  await input.player.client.gameplay.updateActionSubmission.mutate({
    gameId: input.createdGameId,
    turn: input.playerView.turn,
    submittedActionTargets: createSubmittedActionTargetsDtoStub({
      actionId: input.improvedAction.id,
      selectedTargets: { fleet: input.sourceFleet.id, planet: input.destination.id },
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

export async function assertNormalizedInput(input: AssertNormalizedInputInput): Promise<void> {
  const normalizedInput = {
    resources: {
      total: Object.fromEntries(
        Object.values(ResourceType).map((resourceType) => [resourceType, input.retainedView.resources[resourceType].total]),
      ),
      uncommitted: Object.fromEntries(
        Object.values(ResourceType).map((resourceType) => [resourceType, input.retainedView.resources[resourceType].uncommitted]),
      ),
    },
    source: {
      role: "source",
      owner: input.retainedSource.ownerPlayerId === input.retainedView.player.id ? "player" : "other",
      strength: input.retainedSource.strength,
      origin: input.retainedSource.originPlanetId === input.origin.id ? "origin" : "other",
      movement: input.retainedSource.movement ?? null,
    },
    planets: [
      {
        role: "origin",
        owner: input.origin.ownerPlayerId === input.retainedView.player.id ? "player" : input.origin.ownerPlayerId,
        x: input.origin.x,
        y: input.origin.y,
      },
      {
        role: "destination",
        owner: input.destination.ownerPlayerId === null ? null : "other",
        x: input.destination.x,
        y: input.destination.y,
      },
    ],
    authorizedActions: input.retainedView.ruleset.actionPool
      .map(({ id, actionDefinitionId }) => ({ id, actionDefinitionId }))
      .toSorted((first, second) => compareOrdinalStrings(first.id, second.id)),
    currentActions: input.retainedView.actions
      .map(({ id, actionDefinitionId, selectedTargets, selectedInputs, isInProgress }) => ({
        id,
        actionDefinitionId,
        selectedTargets: normalizeParityTargets(selectedTargets, input.retainedSource.id, input.destination.id),
        selectedInputs,
        isInProgress,
      }))
      .toSorted((first, second) => compareOrdinalStrings(first.id, second.id)),
    candidate: {
      id: input.standardAction.id,
      actionDefinitionId: input.standardAction.actionDefinitionId,
      selectedTargets: { fleet: "source", planet: "destination" },
      selectedInputs: { strength: FleetActionSelectionParity.standardStrength },
    },
  }
  expect(normalizedInput).toStrictEqual(FleetActionSelectionParity.normalizedInput)
  await input.player.client.gameplay.updateActionSubmission.mutate({
    gameId: input.createdGameId,
    turn: input.playerView.turn,
    submittedActionTargets: createSubmittedActionTargetsDtoStub({
      actionId: input.standardAction.id,
      selectedTargets: { fleet: input.sourceFleet.id, planet: input.destination.id },
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

export function assertSelectedView(input: AssertSelectedViewInput): void {
  expect(input.selectedView.actions.find(({ id }) => id === input.moveAction.id)).toMatchObject({
    selectedTargets: { fleet: input.sourceFleet.id, planet: input.destination.id },
    selectedInputs: { strength: 20 },
  })
  expect(input.selectedView.actions.find(({ id }) => id === input.attackAction.id)).toMatchObject({
    selectedTargets: { fleet: input.sourceFleet.id, planet: input.destination.id },
    selectedInputs: { strength: 30 },
  })
  expect(input.selectedView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 8, uncommitted: 0 })
  expect(input.selectedView.resources[ResourceType.FUEL]).toStrictEqual({ total: 2, uncommitted: 0 })
  const selectedEvaluation = input.evaluatePublicView(input.selectedView)

  assertScenarioState({ selectedEvaluation, sourceFleet: input.sourceFleet })

  const partialCandidate = evaluateTargetCandidate({
    state: selectedEvaluation.state,
    ruleset: ComposedReservationRuleset,
    draft: { actionId: input.extraAttackAction.id, selectedTargets: {}, selectedInputs: {} },
    targetTag: branded<TargetTag>("fleet"),
    targetId: input.sourceFleet.id,
  })

  assertScenarioState2({ partialCandidate, sourceFleet: input.sourceFleet })
}

export type AssertSelectedViewInput = {
  selectedView: PlayerView
  moveAction: Action
  sourceFleet: Fleet
  destination: Planet
  attackAction: Action
  evaluatePublicView: EvaluatePublicViewCallback
  extraAttackAction: Action
}

export function assertScenarioState(input: AssertScenarioStateInput): void {
  expect({
    status: input.selectedEvaluation.evaluation.status,
    issues: input.selectedEvaluation.evaluation.issues,
    strengthCommitment: input.selectedEvaluation.evaluation.strengthCommitments[input.sourceFleet.id],
    remainingStrength: input.selectedEvaluation.evaluation.remainingStrength[input.sourceFleet.id],
    resourceCommitments: input.selectedEvaluation.evaluation.resourceCommitments,
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

export function assertScenarioState2(input: AssertScenarioState2Input): void {
  expect({
    status: input.partialCandidate.status,
    candidateStatus: input.partialCandidate.candidateStatus,
    candidateIssues: input.partialCandidate.candidateIssues.map(({ code }) => code),
    missingTargets: input.partialCandidate.missingTargets,
    missingInputs: input.partialCandidate.missingInputs,
    strengthCommitment: input.partialCandidate.strengthCommitments[input.sourceFleet.id],
    remainingStrength: input.partialCandidate.remainingStrength[input.sourceFleet.id],
    resourceCommitments: input.partialCandidate.resourceCommitments,
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

async function verifyOutOfRangeSubmission(input: VerifyOutOfRangeSubmissionInput): Promise<void> {
  const outOfRangeSubmission = input.player.client.gameplay.updateActionSubmission.mutate({
    gameId: input.createdGameId,
    turn: input.playerView.turn,
    submittedActionTargets: createSubmittedActionTargetsDtoStub({
      actionId: input.standardAction.id,
      selectedTargets: { fleet: input.sourceFleet.id, planet: input.outsideStandardRange.id },
      selectedInputs: { strength: FleetActionSelectionParity.standardStrength },
    }),
  })
  await expect(outOfRangeSubmission).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
  const missingForceSubmission = input.player.client.gameplay.updateActionSubmission.mutate({
    gameId: input.createdGameId,
    turn: input.playerView.turn,
    submittedActionTargets: createSubmittedActionTargetsDtoStub({
      actionId: input.standardAction.id,
      selectedTargets: { fleet: input.sourceFleet.id, planet: input.destination.id },
      selectedInputs: {},
    }),
  })
  await expect(missingForceSubmission).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
}

async function verifyOverStrengthSubmission(input: VerifyOverStrengthSubmissionInput): Promise<void> {
  const overStrengthSubmission = input.player.client.gameplay.updateActionSubmission.mutate({
    gameId: input.createdGameId,
    turn: input.playerView.turn,
    submittedActionTargets: createSubmittedActionTargetsDtoStub({
      actionId: input.standardAction.id,
      selectedTargets: { fleet: input.sourceFleet.id, planet: input.destination.id },
      selectedInputs: { strength: 51 },
    }),
  })
  await expect(overStrengthSubmission).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })

  // The public DTO accepts only matched target/input objects or a matched null cancellation.
  await expect(
    input.player.client.gameplay.updateActionSubmission.mutate({
      gameId: input.createdGameId,
      turn: input.playerView.turn,
      submittedActionTargets: { actionId: input.standardAction.id, selectedTargets: null, selectedInputs: {} },
    }),
  ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
  await expect(
    input.player.client.gameplay.updateActionSubmission.mutate({
      gameId: input.createdGameId,
      turn: input.playerView.turn,
      submittedActionTargets: { actionId: input.standardAction.id, selectedTargets: {}, selectedInputs: null },
    }),
  ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
}

async function verifyAfterRejectedDrafts(input: VerifyAfterRejectedDraftsInput): Promise<void> {
  for (const invalidStrength of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) {
    await expect(
      input.player.client.gameplay.updateActionSubmission.mutate({
        gameId: input.createdGameId,
        turn: input.playerView.turn,
        submittedActionTargets: {
          actionId: input.standardAction.id,
          selectedTargets: { fleet: input.sourceFleet.id, planet: input.destination.id },
          selectedInputs: { strength: invalidStrength },
        },
      }),
    ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
  }

  const afterRejectedDrafts = await input.player.client.gameplay.getPlayerView.query({ gameId: input.createdGameId })
  expect(afterRejectedDrafts).toStrictEqual(input.playerView)

  // The API accepts a full unreserved force of 50 and releases its costs when the draft is cancelled.
  await input.player.client.gameplay.updateActionSubmission.mutate({
    gameId: input.createdGameId,
    turn: input.playerView.turn,
    submittedActionTargets: createSubmittedActionTargetsDtoStub({
      actionId: input.standardAction.id,
      selectedTargets: { fleet: input.sourceFleet.id, planet: input.destination.id },
      selectedInputs: { strength: 50 },
    }),
  })
}

async function verifyAfterFullForceCancel(input: VerifyAfterFullForceCancelInput): Promise<void> {
  await input.player.client.gameplay.updateActionSubmission.mutate({
    gameId: input.createdGameId,
    turn: input.playerView.turn,
    submittedActionTargets: { actionId: input.standardAction.id, selectedTargets: null, selectedInputs: null },
  })
  const afterFullForceCancel = await input.player.client.gameplay.getPlayerView.query({ gameId: input.createdGameId })
  expect(afterFullForceCancel.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 6, uncommitted: 6 })
  expect(afterFullForceCancel.resources[ResourceType.FUEL]).toStrictEqual({ total: 4, uncommitted: 4 })

  // Exhaust the action costs while leaving one unallocated Strength; the third draft must fail atomically.
  for (const [action, strength] of [
    [input.standardAction, 20],
    [input.improvedAction, 29],
  ] as const) {
    await input.player.client.gameplay.updateActionSubmission.mutate({
      gameId: input.createdGameId,
      turn: input.playerView.turn,
      submittedActionTargets: createSubmittedActionTargetsDtoStub({
        actionId: action.id,
        selectedTargets: { fleet: input.sourceFleet.id, planet: input.destination.id },
        selectedInputs: { strength },
      }),
    })
  }
}

async function verifyBeforeThirdCostAttempt(input: VerifyBeforeThirdCostAttemptInput): Promise<void> {
  const beforeThirdCostAttempt = await input.player.client.gameplay.getPlayerView.query({ gameId: input.createdGameId })
  expect(beforeThirdCostAttempt.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 6, uncommitted: 0 })
  expect(beforeThirdCostAttempt.resources[ResourceType.FUEL]).toStrictEqual({ total: 4, uncommitted: 0 })
  expect(required(beforeThirdCostAttempt.fleets.find(({ id }) => id === input.sourceFleet.id)).strength).toBe(50)
  await expect(
    input.player.client.gameplay.updateActionSubmission.mutate({
      gameId: input.createdGameId,
      turn: input.playerView.turn,
      submittedActionTargets: createSubmittedActionTargetsDtoStub({
        actionId: input.secondStandardAction.id,
        selectedTargets: { fleet: input.sourceFleet.id, planet: input.destination.id },
        selectedInputs: { strength: 1 },
      }),
    }),
  ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
  const afterThirdCostAttempt = await input.player.client.gameplay.getPlayerView.query({ gameId: input.createdGameId })
  expect(afterThirdCostAttempt).toStrictEqual(beforeThirdCostAttempt)
  expect(afterThirdCostAttempt.actions.find(({ id }) => id === input.secondStandardAction.id)).toMatchObject({
    selectedTargets: null,
    selectedInputs: null,
    isInProgress: false,
  })
}

type VerifyOutOfRangeSubmissionInput = {
  player: AuthenticatedApiClient
  createdGameId: GameId
  playerView: PlayerView
  standardAction: Action
  sourceFleet: Fleet
  outsideStandardRange: Planet
  destination: Planet
}

type VerifyOverStrengthSubmissionInput = {
  player: AuthenticatedApiClient
  createdGameId: GameId
  playerView: PlayerView
  standardAction: Action
  sourceFleet: Fleet
  destination: Planet
}

type VerifyAfterRejectedDraftsInput = {
  player: AuthenticatedApiClient
  createdGameId: GameId
  playerView: PlayerView
  standardAction: Action
  sourceFleet: Fleet
  destination: Planet
}

type VerifyAfterFullForceCancelInput = {
  player: AuthenticatedApiClient
  createdGameId: GameId
  playerView: PlayerView
  standardAction: Action
  improvedAction: Action
  sourceFleet: Fleet
  destination: Planet
}

type VerifyBeforeThirdCostAttemptInput = {
  player: AuthenticatedApiClient
  createdGameId: GameId
  sourceFleet: Fleet
  playerView: PlayerView
  secondStandardAction: Action
  destination: Planet
}

type EvaluatePublicViewProjection = {
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

type EvaluatePublicViewCallback = (view: PlayerView) => EvaluatePublicViewProjection

type ParityTargets = { fleet: string | undefined; planet: string | undefined } | null
function normalizeParityTargets(targets: Action["selectedTargets"], sourceId: Fleet["id"], destinationId: Planet["id"]): ParityTargets {
  if (targets === null) {
    return null
  }
  const fleet = targets[branded<TargetTag>("fleet")],
    planet = targets[branded<TargetTag>("planet")]
  return { fleet: fleet === sourceId ? "source" : fleet, planet: planet === destinationId ? "destination" : planet }
}
