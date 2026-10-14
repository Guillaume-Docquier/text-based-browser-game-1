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

export async function assertBeforeRejectedDrafts({
  player,
  createdGameId,
  selectedView,
  attackAction,
  sourceFleet,
  destination,
  buildAction,
  origin,
  submitSelection,
  moveAction,
  evaluatePublicView,
  extraMoveAction,
}: AssertBeforeRejectedDraftsInput): Promise<void> {
  const beforeRejectedDrafts = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })

  await assertScenarioState3({
    player,
    createdGameId,
    selectedView,
    attackAction,
    sourceFleet,
    destination,
    buildAction,
    origin,
    beforeRejectedDrafts,
  })

  await submitSelection(moveAction.id, 19)
  const editedView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
  const editedEvaluation = evaluatePublicView(editedView).evaluation

  verifyEditedEvaluation({ editedEvaluation, sourceFleet, extraMoveAction, editedView, destination, evaluatePublicView })

  await verifyBeforeResourceRejection({ player, createdGameId, editedView, extraMoveAction, sourceFleet, destination, moveAction })
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

export async function assertScenarioState3({
  player,
  createdGameId,
  selectedView,
  attackAction,
  sourceFleet,
  destination,
  buildAction,
  origin,
  beforeRejectedDrafts,
}: AssertScenarioState3Input): Promise<void> {
  await expect(
    player.client.gameplay.updateActionSubmission.mutate({
      gameId: createdGameId,
      turn: selectedView.turn,
      submittedActionTargets: createSubmittedActionTargetsDtoStub({
        actionId: attackAction.id,
        selectedTargets: { fleet: sourceFleet.id, planet: destination.id },
        selectedInputs: { strength: 31 },
      }),
    }),
  ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
  await expect(
    player.client.gameplay.updateActionSubmission.mutate({
      gameId: createdGameId,
      turn: selectedView.turn,
      submittedActionTargets: createSubmittedActionTargetsDtoStub({
        actionId: buildAction.id,
        selectedTargets: { planet: origin.id },
        selectedInputs: {},
      }),
    }),
  ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
  expect(await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })).toStrictEqual(beforeRejectedDrafts)
}

export async function assertCanceledView({
  player,
  createdGameId,
  evaluatePublicView,
  moveAction,
  sourceFleet,
  submitSelection,
  clock,
  turnProcessor,
  turnsRepository,
  attackAction,
}: AssertCanceledViewInput): Promise<void> {
  const canceledView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
  const canceledEvaluation = evaluatePublicView(canceledView).evaluation
  expect(canceledView.actions.find(({ id }) => id === moveAction.id)).toMatchObject({ selectedTargets: null, selectedInputs: null })
  expect(canceledView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 8, uncommitted: 3 })
  expect(canceledView.resources[ResourceType.FUEL]).toStrictEqual({ total: 2, uncommitted: 1 })
  expect(canceledEvaluation.status).toBe("ELIGIBLE")
  expect(canceledEvaluation.strengthCommitments[sourceFleet.id]).toBe(30)
  expect(canceledEvaluation.remainingStrength[sourceFleet.id]).toBe(20)
  expect(canceledEvaluation.resourceCommitments[ResourceType.INFLUENCE]).toBe(5)
  expect(canceledEvaluation.resourceCommitments[ResourceType.FUEL]).toBe(1)

  await submitSelection(moveAction.id, 20)
  const restoredPair = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
  expect(restoredPair.resources[ResourceType.INFLUENCE].uncommitted).toBe(0)
  expect(restoredPair.resources[ResourceType.FUEL].uncommitted).toBe(0)

  // Assert
  await processNextRouterTurn({ clock, turnProcessor, turnsRepository })
  const afterWorkerDeparture = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
  expect(afterWorkerDeparture.fleets.map(({ strength }) => strength).toSorted((first, second) => first - second)).toStrictEqual([20, 30])
  expect(afterWorkerDeparture.fleets.some(({ id }) => id === sourceFleet.id)).toBe(false)
  expect(afterWorkerDeparture.fleets.every(({ movement }) => movement !== undefined)).toBe(true)
  expect(afterWorkerDeparture.resources[ResourceType.INFLUENCE].total).toBe(0)
  expect(afterWorkerDeparture.resources[ResourceType.FUEL].total).toBe(0)
  expect(afterWorkerDeparture.actions.find(({ id }) => id === moveAction.id)?.isInProgress).toBe(true)
  expect(afterWorkerDeparture.actions.find(({ id }) => id === attackAction.id)?.isInProgress).toBe(true)
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

export async function assertBeforeOutOfRangeAttempt({
  player,
  gameId,
  builtView,
  exceptionalAction,
  sourceFleet,
  beyondExceptionalRange,
  standardAction,
  standardDestination,
  improvedAction,
  improvedDestination,
  exceptionalDestination,
  clock,
  turnProcessor,
  turnsRepository,
  initialView,
  origin,
}: AssertBeforeOutOfRangeAttemptInput): Promise<void> {
  await verifyBeforeOutOfRangeAttempt({
    player,
    gameId,
    builtView,
    exceptionalAction,
    sourceFleet,
    beyondExceptionalRange,
    standardAction,
    standardDestination,
    improvedAction,
    improvedDestination,
    exceptionalDestination,
  })
  const submittedView = await player.client.gameplay.getPlayerView.query({ gameId })
  expect(submittedView.actions.find(({ id }) => id === exceptionalAction.id)).toMatchObject({
    selectedTargets: { fleet: sourceFleet.id, planet: exceptionalDestination.id },
    selectedInputs: { strength: 1 },
  })
  await processNextRouterTurn({ clock, turnProcessor, turnsRepository })

  await verifyView({
    player,
    gameId,
    standardAction,
    standardDestination,
    improvedAction,
    improvedDestination,
    exceptionalAction,
    exceptionalDestination,
    initialView,
    origin,
    submittedView,
    sourceFleet,
  })
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

export function assertScenarioState4({ aliceView, source, defender }: AssertScenarioState4Input): void {
  expect(
    aliceView.fleets
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
    [source, defender]
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

export function assertJourney2({
  journey,
  bobHome,
  customAction,
  validTargets,
  remainder,
  source,
  aliceHome,
  firstReload,
  defender,
}: AssertJourney2Input): void {
  expect(journey).toMatchObject({
    strength: 30,
    distanceToEnd: 2.418312565270031,
    destinationPlanetId: bobHome.id,
    movement: {
      speed: 2,
      submission: {
        id: customAction.id,
        actionDefinitionId: RenamedComposedAssault.id,
        selectedTargets: validTargets,
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
  expect(remainder).toMatchObject({ id: source.id, name: source.name, strength: 19, originPlanetId: aliceHome.id })
  expect(firstReload.fleets.find(({ id }) => id === defender.id)?.strength).toBe(20)
  expect(firstReload.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 80, uncommitted: 80 })
  expect(firstReload.resources[ResourceType.FUEL]).toStrictEqual({ total: 95, uncommitted: 95 })
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

function verifyEditedEvaluation({
  editedEvaluation,
  sourceFleet,
  extraMoveAction,
  editedView,
  destination,
  evaluatePublicView,
}: VerifyEditedEvaluationInput): void {
  expect(editedEvaluation.status).toBe("ELIGIBLE")
  expect(editedEvaluation.strengthCommitments[sourceFleet.id]).toBe(49)
  expect(editedEvaluation.remainingStrength[sourceFleet.id]).toBe(1)
  expect(editedEvaluation.resourceCommitments[ResourceType.INFLUENCE]).toBe(8)
  expect(editedEvaluation.resourceCommitments[ResourceType.FUEL]).toBe(2)

  const resourceAttempt = createSubmittedActionStub({
    id: extraMoveAction.id,
    playerId: editedView.player.id,
    actionDefinitionId: MoveFleetStandard.id,
    selectedTargets: { fleet: sourceFleet.id, planet: destination.id },
    selectedInputs: { strength: 1 },
  })
  const editedProjection = evaluatePublicView(editedView)
  const resourceAttemptEvaluation = evaluateSubmittedActions({
    state: editedProjection.state,
    ruleset: ComposedReservationRuleset,
    submissions: [...editedProjection.submissions, resourceAttempt],
  })
  expect(resourceAttemptEvaluation.status).toBe("INELIGIBLE")
  expect(resourceAttemptEvaluation.strengthCommitments[sourceFleet.id]).toBe(50)
  expect(resourceAttemptEvaluation.resourceCommitments[ResourceType.INFLUENCE]).toBe(11)
  expect(resourceAttemptEvaluation.resourceCommitments[ResourceType.FUEL]).toBe(3)
  expect(resourceAttemptEvaluation.issues).toStrictEqual(
    expect.arrayContaining([
      expect.objectContaining({ code: "INSUFFICIENT_RESOURCES", resourceType: ResourceType.INFLUENCE }),
      expect.objectContaining({ code: "INSUFFICIENT_RESOURCES", resourceType: ResourceType.FUEL }),
    ]),
  )
}

async function verifyBeforeResourceRejection({
  player,
  createdGameId,
  editedView,
  extraMoveAction,
  sourceFleet,
  destination,
  moveAction,
}: VerifyBeforeResourceRejectionInput): Promise<void> {
  const beforeResourceRejection = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
  const exhaustedResourcesSubmission = player.client.gameplay.updateActionSubmission.mutate({
    gameId: createdGameId,
    turn: editedView.turn,
    submittedActionTargets: createSubmittedActionTargetsDtoStub({
      actionId: extraMoveAction.id,
      selectedTargets: { fleet: sourceFleet.id, planet: destination.id },
      selectedInputs: { strength: 1 },
    }),
  })
  await expect(exhaustedResourcesSubmission).rejects.toThrow("Invalid action submission, targets are invalid or costs cannot be paid.")
  await expect(exhaustedResourcesSubmission).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
  expect(await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })).toStrictEqual(beforeResourceRejection)

  await player.client.gameplay.updateActionSubmission.mutate({
    gameId: createdGameId,
    turn: editedView.turn,
    submittedActionTargets: { actionId: moveAction.id, selectedTargets: null, selectedInputs: null },
  })
}

async function verifyBeforeOutOfRangeAttempt({
  player,
  gameId,
  builtView,
  exceptionalAction,
  sourceFleet,
  beyondExceptionalRange,
  standardAction,
  standardDestination,
  improvedAction,
  improvedDestination,
  exceptionalDestination,
}: VerifyBeforeOutOfRangeAttemptInput): Promise<void> {
  const beforeOutOfRangeAttempt = await player.client.gameplay.getPlayerView.query({ gameId })
  await expect(
    player.client.gameplay.updateActionSubmission.mutate({
      gameId,
      turn: builtView.turn,
      submittedActionTargets: createSubmittedActionTargetsDtoStub({
        actionId: exceptionalAction.id,
        selectedTargets: { fleet: sourceFleet.id, planet: beyondExceptionalRange.id },
        selectedInputs: { strength: 1 },
      }),
    }),
  ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
  // Assert
  expect(await player.client.gameplay.getPlayerView.query({ gameId })).toStrictEqual(beforeOutOfRangeAttempt)

  // Act
  for (const [action, destination] of [
    [standardAction, standardDestination],
    [improvedAction, improvedDestination],
    [exceptionalAction, exceptionalDestination],
  ] as const) {
    await player.client.gameplay.updateActionSubmission.mutate({
      gameId,
      turn: builtView.turn,
      submittedActionTargets: createSubmittedActionTargetsDtoStub({
        actionId: action.id,
        selectedTargets: { fleet: sourceFleet.id, planet: destination.id },
        selectedInputs: { strength: 1 },
      }),
    })
  }
}

async function verifyView({
  player,
  gameId,
  standardAction,
  standardDestination,
  improvedAction,
  improvedDestination,
  exceptionalAction,
  exceptionalDestination,
  initialView,
  origin,
  submittedView,
  sourceFleet,
}: VerifyViewInput): Promise<void> {
  const resolvedView = await player.client.gameplay.getPlayerView.query({ gameId })

  // Assert
  for (const [action, destination, speed, expectedRemainingDistance] of [
    [standardAction, standardDestination, 0.1, Number.parseFloat("1.8357059928924176")],
    [improvedAction, improvedDestination, 1, 6.693909440718526],
    [exceptionalAction, exceptionalDestination, 5, 5.129282735155494],
  ] as const) {
    const journey = resolvedView.fleets.find(({ movement }) => movement?.submission.id === action.id)
    Assert.isDefined(journey)
    expect(journey).toMatchObject({
      ownerPlayerId: initialView.player.id,
      originPlanetId: origin.id,
      destinationPlanetId: destination.id,
      strength: 1,
      distanceToEnd: expect.closeTo(expectedRemainingDistance, 12),
      movement: {
        speed,
        departureTurn: submittedView.turn,
        pendingArrivalEffects: [],
        submission: {
          id: action.id,
          actionDefinitionId: action.actionDefinitionId,
          selectedTargets: { fleet: sourceFleet.id, planet: destination.id },
          selectedInputs: { strength: 1 },
        },
      },
    })
  }
  expect(resolvedView.fleets.find(({ id, movement }) => id === sourceFleet.id && movement === undefined)?.strength).toBe(7)
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
