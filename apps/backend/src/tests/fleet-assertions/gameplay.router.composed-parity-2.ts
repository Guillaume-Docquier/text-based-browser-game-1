import { Assert } from "@guillaume-docquier/tools-ts"
import { evaluateSubmittedActions } from "shared/action-submission/evaluateActionSelection.ts"
import type { EligibilityIssueCode } from "shared/action-submission/selectionEvaluation.ts"
import type { GameId } from "shared/domain/games/GameId.ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import type { createResourcesStub } from "shared/domain/resources/Resources.stub.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import type { ActionDefinitionId } from "shared/domain/ruleset/action-definitions/ActionDefinitionId.ts"
import type { InputTag } from "shared/domain/ruleset/action-definitions/InputTag.ts"
import type { PositiveInteger } from "shared/domain/ruleset/action-definitions/PositiveInteger.ts"
import type { TargetTag } from "shared/domain/ruleset/action-definitions/TargetTag.ts"
import type { TargetId } from "shared/domain/ruleset/target-definitions/TargetId.ts"
import { createSubmittedActionStub } from "shared/domain/turns/actions/Action.stub.ts"
import type { Action as CapturedAction } from "shared/domain/turns/actions/Action.ts"
import type { ActionId } from "shared/domain/turns/actions/ActionId.ts"
import type { createFleetStub } from "shared/domain/world/fleets/Fleet.stub.ts"
import type { FleetId } from "shared/domain/world/fleets/FleetId.ts"
import type { PlanetId } from "shared/domain/world/planets/PlanetId.ts"
import { expect } from "vitest"
import { createSubmittedActionTargetsDtoStub } from "#api/gameplay/SubmittedActionTargetsDto.stub.ts"
import type { PlayerView, Action, Fleet, Planet } from "#api/types.ts"
import type { ControlledClock } from "#lib/ControlledClock.ts"
import { BuildFleetStandard } from "#lib/rulesets/standard/action-definitions/build-fleet.ts"
import { MoveFleetStandard } from "#lib/rulesets/standard/action-definitions/move-fleet.ts"
import type { AuthenticatedApiClient } from "#tests/ApiClient.ts"
import type { TurnProcessor } from "#turn-processing/TurnProcessor.ts"
import type { TurnsRepository } from "#turn-processing/turns.repository.ts"
import { ComposedReservationRuleset, RenamedComposedAssault, processNextRouterTurn } from "../fleet-gameplay/gameplay.router.ts"
import type { AssertScenarioState3Input, AssertScenarioState4Input } from "./gameplay.router.composed-parity.ts"

export async function assertBeforeRejectedDrafts(input: AssertBeforeRejectedDraftsInput): Promise<void> {
  const beforeRejectedDrafts = await input.player.client.gameplay.getPlayerView.query({ gameId: input.createdGameId })

  await assertScenarioState3({ ...input, beforeRejectedDrafts })

  await input.submitSelection(input.moveAction.id, 19)
  const editedView = await input.player.client.gameplay.getPlayerView.query({ gameId: input.createdGameId })
  const editedEvaluation = input.evaluatePublicView(editedView).evaluation

  verifyEditedEvaluation({ ...input, editedEvaluation, editedView })

  await verifyBeforeResourceRejection({ ...input, editedView })
}

export type AssertBeforeRejectedDraftsInput = {
  player: AuthenticatedApiClient
  createdGameId: GameId
  selectedView: PlayerView
  attackAction: Action
  sourceFleet: Fleet
  destination: Planet
  buildAction: Action
  origin: Planet
  submitSelection: (actionId: string, strength: number) => Promise<void>
  moveAction: Action
  evaluatePublicView: EvaluatePublicViewCallback
  extraMoveAction: Action
}

export async function assertScenarioState3(input: AssertScenarioState3Input): Promise<void> {
  await expect(
    input.player.client.gameplay.updateActionSubmission.mutate({
      gameId: input.createdGameId,
      turn: input.selectedView.turn,
      submittedActionTargets: createSubmittedActionTargetsDtoStub({
        actionId: input.attackAction.id,
        selectedTargets: { fleet: input.sourceFleet.id, planet: input.destination.id },
        selectedInputs: { strength: 31 },
      }),
    }),
  ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
  await expect(
    input.player.client.gameplay.updateActionSubmission.mutate({
      gameId: input.createdGameId,
      turn: input.selectedView.turn,
      submittedActionTargets: createSubmittedActionTargetsDtoStub({
        actionId: input.buildAction.id,
        selectedTargets: { planet: input.origin.id },
        selectedInputs: {},
      }),
    }),
  ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
  expect(await input.player.client.gameplay.getPlayerView.query({ gameId: input.createdGameId })).toStrictEqual(input.beforeRejectedDrafts)
}

export async function assertCanceledView(input: AssertCanceledViewInput): Promise<void> {
  const canceledView = await input.player.client.gameplay.getPlayerView.query({ gameId: input.createdGameId })
  const canceledEvaluation = input.evaluatePublicView(canceledView).evaluation
  expect(canceledView.actions.find(({ id }) => id === input.moveAction.id)).toMatchObject({ selectedTargets: null, selectedInputs: null })
  expect(canceledView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 8, uncommitted: 3 })
  expect(canceledView.resources[ResourceType.FUEL]).toStrictEqual({ total: 2, uncommitted: 1 })
  expect(canceledEvaluation.status).toBe("ELIGIBLE")
  expect(canceledEvaluation.strengthCommitments[input.sourceFleet.id]).toBe(30)
  expect(canceledEvaluation.remainingStrength[input.sourceFleet.id]).toBe(20)
  expect(canceledEvaluation.resourceCommitments[ResourceType.INFLUENCE]).toBe(5)
  expect(canceledEvaluation.resourceCommitments[ResourceType.FUEL]).toBe(1)

  await input.submitSelection(input.moveAction.id, 20)
  const restoredPair = await input.player.client.gameplay.getPlayerView.query({ gameId: input.createdGameId })
  expect(restoredPair.resources[ResourceType.INFLUENCE].uncommitted).toBe(0)
  expect(restoredPair.resources[ResourceType.FUEL].uncommitted).toBe(0)

  // Assert
  await processNextRouterTurn({ ...input })
  const afterWorkerDeparture = await input.player.client.gameplay.getPlayerView.query({ gameId: input.createdGameId })
  expect(afterWorkerDeparture.fleets.map(({ strength }) => strength).toSorted((first, second) => first - second)).toStrictEqual([20, 30])
  expect(afterWorkerDeparture.fleets.some(({ id }) => id === input.sourceFleet.id)).toBe(false)
  expect(afterWorkerDeparture.fleets.every(({ movement }) => movement !== undefined)).toBe(true)
  expect(afterWorkerDeparture.resources[ResourceType.INFLUENCE].total).toBe(0)
  expect(afterWorkerDeparture.resources[ResourceType.FUEL].total).toBe(0)
  expect(afterWorkerDeparture.actions.find(({ id }) => id === input.moveAction.id)?.isInProgress).toBe(true)
  expect(afterWorkerDeparture.actions.find(({ id }) => id === input.attackAction.id)?.isInProgress).toBe(true)
}

export type AssertCanceledViewInput = {
  player: AuthenticatedApiClient
  createdGameId: GameId
  evaluatePublicView: EvaluatePublicViewCallback
  moveAction: Action
  sourceFleet: Fleet
  submitSelection: (actionId: string, strength: number) => Promise<void>
  clock: ControlledClock
  turnProcessor: TurnProcessor
  turnsRepository: TurnsRepository
  attackAction: Action
}

export async function assertBeforeOutOfRangeAttempt(input: AssertBeforeOutOfRangeAttemptInput): Promise<void> {
  await verifyBeforeOutOfRangeAttempt({ ...input })
  const submittedView = await input.player.client.gameplay.getPlayerView.query({ gameId: input.gameId })
  expect(submittedView.actions.find(({ id }) => id === input.exceptionalAction.id)).toMatchObject({
    selectedTargets: { fleet: input.sourceFleet.id, planet: input.exceptionalDestination.id },
    selectedInputs: { strength: 1 },
  })
  await processNextRouterTurn({ ...input })

  await verifyView({ ...input, submittedView })
}

export type AssertBeforeOutOfRangeAttemptInput = {
  player: AuthenticatedApiClient
  gameId: GameId
  builtView: PlayerView
  exceptionalAction: Action
  sourceFleet: Fleet
  beyondExceptionalRange: Planet
  standardAction: Action
  standardDestination: Planet
  improvedAction: Action
  improvedDestination: Planet
  exceptionalDestination: Planet
  clock: ControlledClock
  turnProcessor: TurnProcessor
  turnsRepository: TurnsRepository
  initialView: PlayerView
  origin: Planet
}

export async function assertMath({
  aliceHome,
  bobHome,
  aliceView,
  alice,
  gameId,
  bobView,
  bob,
  processReadyTurn,
}: AssertMathInput): Promise<AssertMathResult> {
  expect([aliceHome.coordinates, bobHome.coordinates].toSorted()).toStrictEqual(["44:98:05", "45:83:40"])
  expect(Math.hypot(bobHome.x - aliceHome.x, bobHome.y - aliceHome.y)).toBe(4.418312565270031)

  for (let buildRound = 1; buildRound <= 5; buildRound += 1) {
    aliceView = await alice.client.gameplay.getPlayerView.query({ gameId })
    const aliceBuild = aliceView.actions.find(({ actionDefinitionId }) => actionDefinitionId === BuildFleetStandard.id)
    Assert.isDefined(aliceBuild)
    await alice.client.gameplay.updateActionSubmission.mutate({
      gameId,
      turn: aliceView.turn,
      submittedActionTargets: createSubmittedActionTargetsDtoStub({
        actionId: aliceBuild.id,
        selectedTargets: { planet: aliceHome.id },
        selectedInputs: {},
      }),
    })
    if (buildRound <= 2) {
      bobView = await bob.client.gameplay.getPlayerView.query({ gameId })
      const bobBuild = bobView.actions.find(({ actionDefinitionId }) => actionDefinitionId === BuildFleetStandard.id)
      Assert.isDefined(bobBuild)
      await bob.client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: bobView.turn,
        submittedActionTargets: createSubmittedActionTargetsDtoStub({
          actionId: bobBuild.id,
          selectedTargets: { planet: bobHome.id },
          selectedInputs: {},
        }),
      })
    } else {
      bobView = await bob.client.gameplay.getPlayerView.query({ gameId })
    }
    await processReadyTurn(gameId, aliceView.turn, [alice, bob])
  }

  aliceView = await alice.client.gameplay.getPlayerView.query({ gameId })
  bobView = await bob.client.gameplay.getPlayerView.query({ gameId })

  return { aliceView, bobView }
}

export type AssertMathInput = {
  aliceHome: Planet
  bobHome: Planet
  aliceView: PlayerView
  alice: AuthenticatedApiClient
  gameId: GameId
  bobView: PlayerView
  bob: AuthenticatedApiClient
  processReadyTurn: (gameId: number, turn: number, clients: readonly AuthenticatedApiClient[]) => Promise<void>
}

export type AssertMathResult = { aliceView: PlayerView; bobView: PlayerView }

export async function assertActionSelections({
  alice,
  gameId,
  aliceView,
  stationaryAssault,
  source,
  aliceHome,
  processReadyTurn,
  bob,
  defender,
}: AssertActionSelectionsInput): Promise<AssertActionSelectionsResult> {
  await alice.client.gameplay.updateActionSubmission.mutate({
    gameId,
    turn: aliceView.turn,
    submittedActionTargets: createSubmittedActionTargetsDtoStub({
      actionId: stationaryAssault.id,
      selectedTargets: { station: source.id, battlePlanet: aliceHome.id },
      selectedInputs: {},
    }),
  })
  await processReadyTurn(gameId, aliceView.turn, [alice, bob])
  aliceView = await alice.client.gameplay.getPlayerView.query({ gameId })

  assertScenarioState4({ aliceView, source, defender })

  return { aliceView }
}

export type AssertActionSelectionsInput = {
  alice: AuthenticatedApiClient
  gameId: GameId
  aliceView: PlayerView
  stationaryAssault: Action
  source: Fleet
  aliceHome: Planet
  processReadyTurn: (gameId: number, turn: number, clients: readonly AuthenticatedApiClient[]) => Promise<void>
  bob: AuthenticatedApiClient
  defender: Fleet
}

export type AssertActionSelectionsResult = { aliceView: PlayerView }

export function assertScenarioState4(input: AssertScenarioState4Input): void {
  expect(
    input.aliceView.fleets
      .map(({ id, name, ownerPlayerId, originPlanetId, strength, movement }) => ({
        id,
        name,
        ownerPlayerId,
        originPlanetId,
        strength,
        movement,
      }))
      .toSorted((left, right) => left.id.localeCompare(right.id)),
  ).toStrictEqual(
    [input.source, input.defender]
      .map(({ id, name, ownerPlayerId, originPlanetId, strength, movement }) => ({
        id,
        name,
        ownerPlayerId,
        originPlanetId,
        strength,
        movement,
      }))
      .toSorted((left, right) => left.id.localeCompare(right.id)),
  )
}

export function assertJourney2(input: AssertJourney2Input): void {
  expect(input.journey).toMatchObject({
    strength: 30,
    distanceToEnd: 2.418312565270031,
    destinationPlanetId: input.bobHome.id,
    movement: {
      speed: 2,
      submission: {
        id: input.customAction.id,
        actionDefinitionId: RenamedComposedAssault.id,
        selectedTargets: input.validTargets,
        selectedInputs: { units: 30 },
      },
      pendingArrivalEffects: [
        {
          definitionOrdinal: 3,
          effectDefinition: {
            type: "FLEET_ASSAULT",
            targets: {
              fleet: { actionTargetTag: "originForce" },
              planet: { actionTargetTag: "landingSite" },
            },
          },
        },
      ],
    },
  })
  expect(input.remainder).toMatchObject({ id: input.source.id, name: input.source.name, strength: 19, originPlanetId: input.aliceHome.id })
  expect(input.firstReload.fleets.find(({ id }) => id === input.defender.id)?.strength).toBe(20)
  expect(input.firstReload.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 80, uncommitted: 80 })
  expect(input.firstReload.resources[ResourceType.FUEL]).toStrictEqual({ total: 95, uncommitted: 95 })
}

export type AssertJourney2Input = {
  journey: Fleet
  bobHome: Planet
  customAction: Action
  validTargets: { originForce: FleetId; landingSite: PlanetId }
  remainder: Fleet
  source: Fleet
  aliceHome: Planet
  firstReload: PlayerView
  defender: Fleet
}

function verifyEditedEvaluation(input: VerifyEditedEvaluationInput): void {
  expect(input.editedEvaluation.status).toBe("ELIGIBLE")
  expect(input.editedEvaluation.strengthCommitments[input.sourceFleet.id]).toBe(49)
  expect(input.editedEvaluation.remainingStrength[input.sourceFleet.id]).toBe(1)
  expect(input.editedEvaluation.resourceCommitments[ResourceType.INFLUENCE]).toBe(8)
  expect(input.editedEvaluation.resourceCommitments[ResourceType.FUEL]).toBe(2)

  const resourceAttempt = createSubmittedActionStub({
    id: input.extraMoveAction.id,
    playerId: input.editedView.player.id,
    actionDefinitionId: MoveFleetStandard.id,
    selectedTargets: { fleet: input.sourceFleet.id, planet: input.destination.id },
    selectedInputs: { strength: 1 },
  })
  const editedProjection = input.evaluatePublicView(input.editedView)
  const resourceAttemptEvaluation = evaluateSubmittedActions({
    state: editedProjection.state,
    ruleset: ComposedReservationRuleset,
    submissions: [...editedProjection.submissions, resourceAttempt],
  })
  expect(resourceAttemptEvaluation.status).toBe("INELIGIBLE")
  expect(resourceAttemptEvaluation.strengthCommitments[input.sourceFleet.id]).toBe(50)
  expect(resourceAttemptEvaluation.resourceCommitments[ResourceType.INFLUENCE]).toBe(11)
  expect(resourceAttemptEvaluation.resourceCommitments[ResourceType.FUEL]).toBe(3)
  expect(resourceAttemptEvaluation.issues).toStrictEqual(
    expect.arrayContaining([
      expect.objectContaining({ code: "INSUFFICIENT_RESOURCES", resourceType: ResourceType.INFLUENCE }),
      expect.objectContaining({ code: "INSUFFICIENT_RESOURCES", resourceType: ResourceType.FUEL }),
    ]),
  )
}

async function verifyBeforeResourceRejection(input: VerifyBeforeResourceRejectionInput): Promise<void> {
  const beforeResourceRejection = await input.player.client.gameplay.getPlayerView.query({ gameId: input.createdGameId })
  const exhaustedResourcesSubmission = input.player.client.gameplay.updateActionSubmission.mutate({
    gameId: input.createdGameId,
    turn: input.editedView.turn,
    submittedActionTargets: createSubmittedActionTargetsDtoStub({
      actionId: input.extraMoveAction.id,
      selectedTargets: { fleet: input.sourceFleet.id, planet: input.destination.id },
      selectedInputs: { strength: 1 },
    }),
  })
  await expect(exhaustedResourcesSubmission).rejects.toThrow("Invalid action submission, targets are invalid or costs cannot be paid.")
  await expect(exhaustedResourcesSubmission).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
  expect(await input.player.client.gameplay.getPlayerView.query({ gameId: input.createdGameId })).toStrictEqual(beforeResourceRejection)

  await input.player.client.gameplay.updateActionSubmission.mutate({
    gameId: input.createdGameId,
    turn: input.editedView.turn,
    submittedActionTargets: { actionId: input.moveAction.id, selectedTargets: null, selectedInputs: null },
  })
}

async function verifyBeforeOutOfRangeAttempt(input: VerifyBeforeOutOfRangeAttemptInput): Promise<void> {
  const beforeOutOfRangeAttempt = await input.player.client.gameplay.getPlayerView.query({ gameId: input.gameId })
  await expect(
    input.player.client.gameplay.updateActionSubmission.mutate({
      gameId: input.gameId,
      turn: input.builtView.turn,
      submittedActionTargets: createSubmittedActionTargetsDtoStub({
        actionId: input.exceptionalAction.id,
        selectedTargets: { fleet: input.sourceFleet.id, planet: input.beyondExceptionalRange.id },
        selectedInputs: { strength: 1 },
      }),
    }),
  ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
  // Assert
  expect(await input.player.client.gameplay.getPlayerView.query({ gameId: input.gameId })).toStrictEqual(beforeOutOfRangeAttempt)

  // Act
  for (const [action, destination] of [
    [input.standardAction, input.standardDestination],
    [input.improvedAction, input.improvedDestination],
    [input.exceptionalAction, input.exceptionalDestination],
  ] as const) {
    await input.player.client.gameplay.updateActionSubmission.mutate({
      gameId: input.gameId,
      turn: input.builtView.turn,
      submittedActionTargets: createSubmittedActionTargetsDtoStub({
        actionId: action.id,
        selectedTargets: { fleet: input.sourceFleet.id, planet: destination.id },
        selectedInputs: { strength: 1 },
      }),
    })
  }
}

async function verifyView(input: VerifyViewInput): Promise<void> {
  const resolvedView = await input.player.client.gameplay.getPlayerView.query({ gameId: input.gameId })

  // Assert
  for (const [action, destination, speed, expectedRemainingDistance] of [
    [input.standardAction, input.standardDestination, 0.1, Number.parseFloat("1.8357059928924176")],
    [input.improvedAction, input.improvedDestination, 1, 6.693909440718526],
    [input.exceptionalAction, input.exceptionalDestination, 5, 5.129282735155494],
  ] as const) {
    const journey = resolvedView.fleets.find(({ movement }) => movement?.submission.id === action.id)
    Assert.isDefined(journey)
    expect(journey).toMatchObject({
      ownerPlayerId: input.initialView.player.id,
      originPlanetId: input.origin.id,
      destinationPlanetId: destination.id,
      strength: 1,
      distanceToEnd: expect.closeTo(expectedRemainingDistance, 12),
      movement: {
        speed,
        departureTurn: input.submittedView.turn,
        pendingArrivalEffects: [],
        submission: {
          id: action.id,
          actionDefinitionId: action.actionDefinitionId,
          selectedTargets: { fleet: input.sourceFleet.id, planet: destination.id },
          selectedInputs: { strength: 1 },
        },
      },
    })
  }
  expect(resolvedView.fleets.find(({ id, movement }) => id === input.sourceFleet.id && movement === undefined)?.strength).toBe(7)
}

type VerifyEditedEvaluationInput = {
  editedEvaluation: Readonly<{
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
  sourceFleet: Fleet
  extraMoveAction: Action
  editedView: PlayerView
  destination: Planet
  evaluatePublicView: EvaluatePublicViewCallback
}

type VerifyBeforeResourceRejectionInput = {
  player: AuthenticatedApiClient
  createdGameId: GameId
  editedView: PlayerView
  extraMoveAction: Action
  sourceFleet: Fleet
  destination: Planet
  moveAction: Action
}

type VerifyBeforeOutOfRangeAttemptInput = {
  player: AuthenticatedApiClient
  gameId: GameId
  builtView: PlayerView
  exceptionalAction: Action
  sourceFleet: Fleet
  beyondExceptionalRange: Planet
  standardAction: Action
  standardDestination: Planet
  improvedAction: Action
  improvedDestination: Planet
  exceptionalDestination: Planet
}

type VerifyViewInput = {
  player: AuthenticatedApiClient
  gameId: GameId
  standardAction: Action
  standardDestination: Planet
  improvedAction: Action
  improvedDestination: Planet
  exceptionalAction: Action
  exceptionalDestination: Planet
  initialView: PlayerView
  origin: Planet
  submittedView: PlayerView
  sourceFleet: Fleet
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
