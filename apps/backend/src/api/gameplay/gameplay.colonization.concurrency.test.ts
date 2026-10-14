import { Assert } from "@guillaume-docquier/tools-ts"
import { type NonNegativeNumber, type PositiveNumber, typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { eq } from "drizzle-orm"
import { type GameId, GameIdSchema } from "shared/domain/games/GameId.ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import type { ActionDefinitionId } from "shared/domain/ruleset/action-definitions/ActionDefinitionId.ts"
import type { ActionTier } from "shared/domain/ruleset/action-definitions/ActionTier.ts"
import type { ActionType } from "shared/domain/ruleset/action-definitions/ActionType.ts"
import type { InputTag } from "shared/domain/ruleset/action-definitions/InputTag.ts"
import type { PositiveInteger } from "shared/domain/ruleset/action-definitions/PositiveInteger.ts"
import type { TargetTag } from "shared/domain/ruleset/action-definitions/TargetTag.ts"
import type { EffectDefinitionTargetDefinition } from "shared/domain/ruleset/effect-definitions/EffectDefinitionTargetDefinition.ts"
import type { ResourceLossEffectDefinition } from "shared/domain/ruleset/effect-definitions/ResourceLossEffectDefinition.ts"
import type { TargetType } from "shared/domain/ruleset/target-definitions/TargetType.ts"
import type { createSubmittedActionStub } from "shared/domain/turns/actions/Action.stub.ts"
import type { createFleetStub } from "shared/domain/world/fleets/Fleet.stub.ts"
import type { PendingArrivalEffect } from "shared/domain/world/fleets/Fleet.ts"
import type { FleetId } from "shared/domain/world/fleets/FleetId.ts"
import type { FleetName } from "shared/domain/world/fleets/FleetName.ts"
import type { PlanetId } from "shared/domain/world/planets/PlanetId.ts"
import type { ResolvedTurnState } from "shared/turn-resolution/ResolvedTurnState.ts"
import type { ResolutionPlanet } from "shared/turn-resolution/state/ResolutionPlanet.ts"
import { describe, expect, it } from "vitest"
import type { PlayerView, Fleet, Planet } from "#api/types.ts"
import type { ControlledClock } from "#lib/ControlledClock.ts"
import { fleetsTable, turnsTable } from "#lib/db/schema.ts"
import type { AuthenticatedApiClient } from "#tests/ApiClient.ts"
import type {
  processTurnWithReplay as CapturedprocessTurnWithReplay,
  replayWorkerInputWithState as CapturedreplayWorkerInputWithState,
} from "#tests/colonization/gameplay.colonization.scenarios.ts"
import type {
  createPublicTwoPlayerFixture as CapturedcreatePublicTwoPlayerFixture,
  createFixtureBuildFleetAction,
} from "#tests/colonization/gameplay.colonization.ts"
import { ConcurrencyTestApiServer } from "#tests/ConcurrencyTestApiServer.ts"
import type { AssertContinuationResult, AssertReplayedTargetResult } from "#tests/fleet-assertions/gameplay.colonization.ts"
import type { normalizeApiDate } from "#tests/fleet-concurrency/gameplay.scenarios.ts"
import type { reverseWorkerInputEnumeration } from "#tests/fleet-concurrency/gameplay.ts"
import type { TurnProcessor } from "#turn-processing/TurnProcessor.ts"
import type { TurnsRepository } from "#turn-processing/turns.repository.ts"
import {
  getPlanets,
  getFleetAt,
  processTurnWithReplay,
  captureWorkerInput,
  replayWorkerInputWithState,
} from "../../tests/colonization/gameplay.colonization.scenarios.ts"
import {
  BuildFleet20ForExactColonize,
  BuildFleet10ForStaging,
  BuildFleet16ForStaging,
  BuildFleet35,
  BuildFleet50,
  MoveFleetSpeed10,
  ComposedSuccessAttackColonize,
  logReceipt,
  required,
  submitAction,
  readViews,
  createPublicTwoPlayerFixture,
} from "../../tests/colonization/gameplay.colonization.ts"
import {
  assertLoadedJourney2,
  assertContinuation,
  assertReplayedTarget,
  assertPersistedNextRngState,
} from "../../tests/fleet-assertions/gameplay.colonization.ts"

describe("public Colonization worker companions", () => {
  it("should preserve composed Move, Assault, and Colonize phase order through public worker turns", async () => {
    // Arrange
    await using server = await ConcurrencyTestApiServer.create()
    const fixture = await createPublicTwoPlayerFixture(server)
    const { alice, bob, clients, gameId, clock, turnProcessor, turnsRepository, homeA, homeB, target } = fixture

    // Act & Assert
    const viewsScenario12 = await prepareViewsScenario({
      fixture,
      homeA,
      target,
      homeB,
      alice,
      gameId,
      bob,
      server,
      clock,
      turnsRepository,
      turnProcessor,
      clients,
    })
    const { viewsSetup1, attacker } = viewsScenario12
    let { views } = viewsScenario12

    const composedActionId = await submitAction({
      client: alice.client,
      gameId,
      view: required(views[0]),
      actionDefinitionId: ComposedSuccessAttackColonize.id,
      selectedTargets: { fleet: attacker.id, planet: target.id },
      selectedInputs: { strength: 50 },
    })

    const updatedVerifySelectedViews = await verifySelectedViews({
      ...viewsScenario12,
      ...viewsSetup1,
      clients,
      gameId,
      composedActionId,
      target,
      server,
      clock,
      turnsRepository,
      turnProcessor,
      views,
    })

    views = updatedVerifySelectedViews.views

    const attackerJourneySetup2 = await createAttackerJourneySetup({
      ...viewsScenario12,
      ...viewsSetup1,
      views,
      composedActionId,
      target,
      server,
      clock,
      turnsRepository,
      gameId,
      alice,
      bob,
      turnProcessor,
      clients,
    })
    const { arrivalTurn, updatedAssertContinuation } = attackerJourneySetup2
    views = updatedAssertContinuation.views

    const savedTurns = await server.database
      .select()
      .from(turnsTable)
      .where(eq(turnsTable.gameId, typedParse(GameIdSchema, gameId)))
    const savedNextTurn = savedTurns.find(({ turn }) => turn === arrivalTurn + 1)
    Assert.isDefined(savedNextTurn)

    verifyPersistedNextRngState({
      ...viewsSetup1,
      ...attackerJourneySetup2,
      savedNextTurn,
      gameId,
      homeA,
      homeB,
      target,
      views,
    })
  })

  it.each([
    {
      attackerStrength: 35,
      attackerBuildDefinitionId: BuildFleet35.id,
      defenderStrength: 16,
      defenderBuildDefinitionId: BuildFleet16ForStaging.id,
      expectedSurvivingAttackerStrength: 19,
      expectedAttackerRemovalCount: 0,
      expectedAttackerFleetCount: 1,
      expectedAttackerAtTargetCount: 1,
      preventedReason: "Fleet has 19 Strength, below the 20 required to colonize",
    },
    {
      attackerStrength: 20,
      attackerBuildDefinitionId: BuildFleet20ForExactColonize.id,
      defenderStrength: 20,
      defenderBuildDefinitionId: BuildFleet20ForExactColonize.id,
      expectedSurvivingAttackerStrength: undefined,
      expectedAttackerRemovalCount: 1,
      expectedAttackerFleetCount: 0,
      expectedAttackerAtTargetCount: 0,
      preventedReason: "destroyed before colonization",
    },
  ])(
    "should persist composed Assault before Colonize at strength $attackerStrength versus $defenderStrength",
    async ({
      attackerStrength,
      defenderStrength,
      attackerBuildDefinitionId,
      defenderBuildDefinitionId,
      expectedSurvivingAttackerStrength,
      expectedAttackerRemovalCount,
      expectedAttackerFleetCount,
      expectedAttackerAtTargetCount,
      preventedReason,
    }) => {
      // Arrange
      await using server = await ConcurrencyTestApiServer.create()

      // Act & Assert
      const aliceScenario2 = await prepareAliceScenario({
        server,
        attackerBuildDefinitionId,
        defenderBuildDefinitionId,
        attackerStrength,
        defenderStrength,
      })
      const { aliceSetup3, alice, clients, gameId, clock, turnProcessor, turnsRepository, target, attacker } = aliceScenario2
      let { views, stage } = aliceScenario2
      const composedActionId = await submitAction({
        client: alice.client,
        gameId,
        view: required(views[0]),
        actionDefinitionId: ComposedSuccessAttackColonize.id,
        selectedTargets: { fleet: attacker.id, planet: target.id },
        selectedInputs: { strength: attackerStrength },
      })
      const selectedViews = await readViews(clients, gameId)
      const selectedInfluence = required(selectedViews[0]).resources[ResourceType.INFLUENCE]
      expect(selectedInfluence.uncommitted).toBe(selectedInfluence.total - 25)
      expect(required(selectedViews[0]).resources[ResourceType.COLONY]).toStrictEqual({ total: 0, uncommitted: 0 })

      stage = await processTurnWithReplay({
        server,
        clock,
        turnsRepository,
        turnProcessor,
        clients,
        gameId,
        turn: required(selectedViews[0]).turn,
      })
      views = stage.views

      const workerInputSetup4 = await createWorkerInputSetup({
        ...aliceScenario2,
        ...aliceSetup3,
        views,
        composedActionId,
        stage,
        defenderStrength,
        server,
        attackerStrength,
        preventedReason,
        expectedSurvivingAttackerStrength,
        expectedAttackerFleetCount,
        expectedAttackerRemovalCount,
      })
      const { updatedAssertReplayedTarget } = workerInputSetup4
      views = updatedAssertReplayedTarget.views

      const persistedAttackerSetup5 = await createPersistedAttackerSetup({
        ...aliceSetup3,
        ...workerInputSetup4,
        views,
        expectedSurvivingAttackerStrength,
        selectedInfluence,
        composedActionId,
        server,
        expectedAttackerFleetCount,
        expectedAttackerAtTargetCount,
      })

      verifyPersistedAttacker({
        ...aliceSetup3,
        ...workerInputSetup4,
        persistedAttackerSetup5,
        attackerStrength,
        defenderStrength,
        expectedSurvivingAttackerStrength,
        composedActionId,
        views,
      })
    },
  )
})

async function createViewsSetup(input: CreateViewsSetupInput): Promise<CreateViewsSetupResult> {
  let views = input.fixture.views
  const attackerDistance = Math.hypot(input.homeA.x - input.target.x, input.homeA.y - input.target.y)
  const defenderDistance = Math.hypot(input.homeB.x - input.target.x, input.homeB.y - input.target.y)
  expect(attackerDistance).toBeCloseTo(1.2645395167985714, 12)
  expect(defenderDistance).toBeCloseTo(18.852953053708077, 12)
  expect(input.target.ownerPlayerId).toBeNull()

  await submitAction({
    client: input.alice.client,
    gameId: input.gameId,
    view: required(views[0]),
    actionDefinitionId: BuildFleet50.id,
    selectedTargets: { planet: input.homeA.id },
    selectedInputs: {},
  })
  await submitAction({
    client: input.bob.client,
    gameId: input.gameId,
    view: required(views[1]),
    actionDefinitionId: BuildFleet10ForStaging.id,
    selectedTargets: { planet: input.homeB.id },
    selectedInputs: {},
  })
  let stage = await processTurnWithReplay({ ...input, turn: required(views[0]).turn })
  views = stage.views
  const attacker = getFleetAt(required(views[0]), required(views[0]).player.id, input.homeA.id, 50)
  const defenderSource = getFleetAt(required(views[1]), required(views[1]).player.id, input.homeB.id, 10)
  expect(views.map(({ resources }) => resources[ResourceType.INFLUENCE].total)).toStrictEqual([498, 498])
  expect(views.map(({ resources }) => resources[ResourceType.METAL].total)).toStrictEqual([99, 99])

  const defenderMoveId = await submitAction({
    client: input.bob.client,
    gameId: input.gameId,
    view: required(views[1]),
    actionDefinitionId: MoveFleetSpeed10.id,
    selectedTargets: { fleet: defenderSource.id, planet: input.target.id },
    selectedInputs: { strength: 10 },
  })
  stage = await processTurnWithReplay({ ...input, turn: required(views[0]).turn })
  views = stage.views
  const defenderJourney = required(views[1]).fleets.find(({ movement }) => movement?.submission.id === defenderMoveId)
  Assert.isDefined(defenderJourney)
  return { views, attackerDistance, defenderDistance, stage, attacker, defenderJourney }
}

async function createAttackerJourneySetup(input: CreateAttackerJourneySetupInput): Promise<CreateAttackerJourneySetupResult> {
  const attackerJourney = required(input.views[0]).fleets.find(({ movement }) => movement?.submission.id === input.composedActionId)
  Assert.isDefined(attackerJourney)
  expect(attackerJourney.distanceToEnd).toBeCloseTo(0.2645395167985714, 12)
  expect(required(input.views[0]).fleets.find(({ id }) => id === input.attacker.id)).toBeUndefined()
  expect(required(input.views[1]).fleets.find(({ id }) => id === input.defender.id)?.strength).toBe(10)
  expect(getPlanets(required(input.views[0])).find(({ id }) => id === input.target.id)?.ownerPlayerId).toBeNull()

  const arrivalTurn = required(input.views[0]).turn
  const arrivalInput = await captureWorkerInput({ ...input, turn: arrivalTurn })
  const arrivalReplay = replayWorkerInputWithState(arrivalInput)
  Assert.isSuccess(arrivalReplay.resolved)
  const loadedDefinition = arrivalInput.ruleset.actionDefinitions[ComposedSuccessAttackColonize.id]
  Assert.isDefined(loadedDefinition)
  expect(loadedDefinition.effects.map(({ type }) => type)).toStrictEqual(["FLEET_COLONIZE", "FLEET_ASSAULT", "FLEET_MOVE"])
  expect(loadedDefinition.effects).toMatchObject([
    { targets: { fleet: { actionTargetTag: "fleet" }, planet: { actionTargetTag: "planet" } }, parameters: { strengthRequirement: 20 } },
    { targets: { fleet: { actionTargetTag: "fleet" }, planet: { actionTargetTag: "planet" } } },
    {
      targets: { fleet: { actionTargetTag: "fleet" }, planet: { actionTargetTag: "planet" } },
      inputs: { strength: { actionInputTag: "strength", inputType: "POSITIVE_INTEGER" } },
      parameters: { speed: 1 },
    },
  ])
  const loadedJourney = arrivalInput.fleets[attackerJourney.id]
  Assert.isDefined(loadedJourney)

  assertLoadedJourney2({ ...input, loadedJourney, attackerJourney, arrivalInput })

  Assert.isSuccess(arrivalReplay.resolved)
  const continuation = arrivalReplay.resolved.value.resolvedContinuations.find(
    ({ originatingSubmission }) => originatingSubmission.id === input.composedActionId,
  )
  Assert.isDefined(continuation)

  Assert.isSuccess(arrivalReplay.resolved)
  const assertAssertContinuationState2ResolvedPhase2Value1 = arrivalReplay.resolved.value

  const updatedAssertContinuation = await assertContinuation({
    ...input,
    assertAssertContinuationState2ResolvedPhase2Value1,
    continuation,
    attackerJourney,
    arrivalReplay,
    arrivalInput,
    arrivalTurn,
  })
  return { attackerJourney, arrivalTurn, arrivalInput, arrivalReplay, loadedDefinition, continuation, updatedAssertContinuation }
}

async function createAliceSetup(input: CreateAliceSetupInput): Promise<CreateAliceSetupResult> {
  const fixture = await createPublicTwoPlayerFixture(input.server)
  const { alice, bob, clients, gameId, clock, turnProcessor, turnsRepository, homeA, homeB, target } = fixture
  let views = fixture.views
  const defenderDistance = Math.hypot(homeB.x - target.x, homeB.y - target.y)
  expect(defenderDistance).toBeCloseTo(18.852953053708077, 12)
  expect(target.ownerPlayerId).toBeNull()

  await submitAction({
    client: alice.client,
    gameId,
    view: required(views[0]),
    actionDefinitionId: input.attackerBuildDefinitionId,
    selectedTargets: { planet: homeA.id },
    selectedInputs: {},
  })
  await submitAction({
    client: bob.client,
    gameId,
    view: required(views[1]),
    actionDefinitionId: input.defenderBuildDefinitionId,
    selectedTargets: { planet: homeB.id },
    selectedInputs: {},
  })
  const stage = await processTurnWithReplay({
    server: input.server,
    clock,
    turnsRepository,
    turnProcessor,
    clients,
    gameId,
    turn: required(views[0]).turn,
  })
  views = stage.views
  const attacker = getFleetAt(required(views[0]), required(views[0]).player.id, homeA.id, input.attackerStrength)
  const defenderSource = getFleetAt(required(views[1]), required(views[1]).player.id, homeB.id, input.defenderStrength)
  const defenderMoveId = await submitAction({
    client: bob.client,
    gameId,
    view: required(views[1]),
    actionDefinitionId: MoveFleetSpeed10.id,
    selectedTargets: { fleet: defenderSource.id, planet: target.id },
    selectedInputs: { strength: input.defenderStrength },
  })
  return { alice, clients, gameId, clock, turnProcessor, turnsRepository, target, views, defenderDistance, stage, attacker, defenderMoveId }
}

async function createWorkerInputSetup(input: CreateWorkerInputSetupInput): Promise<CreateWorkerInputSetupResult> {
  const arrivingJourney = required(input.views[0]).fleets.find(({ movement }) => movement?.submission.id === input.composedActionId)
  Assert.isDefined(arrivingJourney)
  expect(arrivingJourney.distanceToEnd).toBeCloseTo(0.2645395167985714, 12)
  expect(input.stage.resolved.fleets[input.defenderJourney.id]?.arrivedAtTick).toBe(18)
  expect(getFleetAt(required(input.views[1]), required(input.views[1]).player.id, input.target.id, input.defenderStrength).id).toBe(
    input.defenderJourney.id,
  )
  expect(getPlanets(required(input.views[0])).find(({ id }) => id === input.target.id)?.ownerPlayerId).toBeNull()

  const workerInput = await captureWorkerInput({ ...input, turn: required(input.views[0]).turn })
  const replay = replayWorkerInputWithState(workerInput)
  Assert.isSuccess(replay.resolved)
  const loadedAttacker = Object.values(workerInput.fleets).find(({ movement }) => movement?.submission.id === input.composedActionId)
  Assert.isDefined(loadedAttacker)
  const loadedDefender = workerInput.fleets[input.defenderJourney.id]
  Assert.isDefined(loadedDefender)
  expect(loadedAttacker).toMatchObject({ strength: input.attackerStrength, movement: { submission: { id: input.composedActionId } } })
  expect(loadedDefender).toMatchObject({ strength: input.defenderStrength, originPlanetId: input.target.id })
  expect(loadedDefender.movement).toBeUndefined()
  expect(
    loadedAttacker.movement?.pendingArrivalEffects.map(({ effectDefinition, definitionOrdinal }) => ({
      type: effectDefinition.type,
      definitionOrdinal,
    })),
  ).toStrictEqual([
    { type: "FLEET_COLONIZE", definitionOrdinal: 1 },
    { type: "FLEET_ASSAULT", definitionOrdinal: 2 },
  ])

  Assert.isSuccess(replay.resolved)
  const replayedTarget = replay.resolved.value.planets[input.target.id]
  Assert.isSuccess(replay.resolved)
  const continuation = replay.resolved.value.resolvedContinuations.find(
    ({ originatingSubmission }) => originatingSubmission.id === input.composedActionId,
  )
  Assert.isDefined(continuation)

  Assert.isSuccess(replay.resolved)
  const assertAssertReplayedTargetState1ResolvedPhase3Value1 = replay.resolved.value

  const updatedAssertReplayedTarget = await assertReplayedTarget({
    ...input,
    assertAssertReplayedTargetState1ResolvedPhase3Value1,
    replayedTarget,
    continuation,
    loadedAttacker,
    loadedDefender,
    expectedSurvivingAttackerStrength: input.expectedSurvivingAttackerStrength,
  })
  return { workerInput, replay, loadedAttacker, loadedDefender, replayedTarget, continuation, updatedAssertReplayedTarget }
}

async function createPersistedAttackerSetup(input: CreatePersistedAttackerSetupInput): Promise<CreatePersistedAttackerSetupResult> {
  const persistedAttacker = required(input.views[0]).fleets.find(({ id }) => id === input.loadedAttacker.id)
  expect(persistedAttacker?.strength).toBe(input.expectedSurvivingAttackerStrength)

  expect(persistedAttacker?.movement).toBeUndefined()
  expect(persistedAttacker?.destinationPlanetId).toBeUndefined()
  expect(required(input.views[0]).resources[ResourceType.INFLUENCE]).toStrictEqual({
    total: input.selectedInfluence.total - 25,
    uncommitted: input.selectedInfluence.total - 25,
  })
  expect(required(input.views[0]).resources[ResourceType.COLONY]).toStrictEqual({ total: 0, uncommitted: 0 })
  expect(required(input.views[0]).actions.find(({ id }) => id === input.composedActionId)).toMatchObject({
    selectedTargets: null,
    isInProgress: false,
  })

  const persistedFleetRows = await input.server.database
    .select()
    .from(fleetsTable)
    .where(eq(fleetsTable.gameId, typedParse(GameIdSchema, input.gameId)))
  expect(persistedFleetRows.find(({ id }) => id === input.loadedDefender.id)).toBeUndefined()
  expect(persistedFleetRows.find(({ id }) => id === input.loadedAttacker.id)?.strength).toBe(input.expectedSurvivingAttackerStrength)
  expect(persistedFleetRows.filter(({ id }) => id === input.loadedAttacker.id)).toHaveLength(input.expectedAttackerFleetCount)
  expect(
    persistedFleetRows
      .filter(({ id }) => id === input.loadedAttacker.id)
      .filter(({ originPlanetId }) => originPlanetId === input.target.id),
  ).toHaveLength(input.expectedAttackerAtTargetCount)
  const savedTurns = await input.server.database
    .select()
    .from(turnsTable)
    .where(eq(turnsTable.gameId, typedParse(GameIdSchema, input.gameId)))
  const savedNextTurn = savedTurns.find(({ turn }) => turn === input.workerInput.turn + 1)
  Assert.isDefined(savedNextTurn)

  Assert.isSuccess(input.replay.resolved)
  const assertPersistedNextRngStatePhase4Value1 = input.replay.resolved.value
  return { persistedAttacker, persistedFleetRows, savedNextTurn, assertPersistedNextRngStatePhase4Value1 }
}

type CreateViewsSetupInput = {
  fixture: Awaited<ReturnType<typeof CapturedcreatePublicTwoPlayerFixture>>
  homeA: Planet
  target: Planet
  homeB: Planet
  alice: AuthenticatedApiClient
  gameId: number
  bob: AuthenticatedApiClient
  server: ConcurrencyTestApiServer
  clock: ControlledClock
  turnsRepository: TurnsRepository
  turnProcessor: TurnProcessor
  clients: readonly [AuthenticatedApiClient, AuthenticatedApiClient]
}

type CreateViewsSetupResult = {
  views: PlayerView[]
  attackerDistance: number
  defenderDistance: number
  stage: Awaited<ReturnType<typeof CapturedprocessTurnWithReplay>>
  attacker: Fleet
  defenderJourney: Fleet
}

type CreateAttackerJourneySetupInput = {
  views: PlayerView[]
  composedActionId: string
  attacker: Fleet
  defender: Fleet
  target: Planet
  server: ConcurrencyTestApiServer
  clock: ControlledClock
  turnsRepository: TurnsRepository
  gameId: number
  alice: AuthenticatedApiClient
  bob: AuthenticatedApiClient
  turnProcessor: TurnProcessor
  clients: readonly [AuthenticatedApiClient, AuthenticatedApiClient]
}

type CreateAttackerJourneySetupResult = {
  attackerJourney: Fleet
  arrivalTurn: number
  arrivalInput: ReturnType<typeof reverseWorkerInputEnumeration>
  arrivalReplay: ReturnType<typeof CapturedreplayWorkerInputWithState>
  loadedDefinition: ReturnType<typeof createFixtureBuildFleetAction>
  continuation: ResolvedTurnState["resolvedContinuations"][number]
  updatedAssertContinuation: AssertContinuationResult
}

type CreateAliceSetupInput = {
  server: ConcurrencyTestApiServer
  attackerBuildDefinitionId: ActionDefinitionId
  defenderBuildDefinitionId: ActionDefinitionId
  attackerStrength: number
  defenderStrength: number
}

type CreateAliceSetupResult = {
  alice: AuthenticatedApiClient
  clients: readonly [AuthenticatedApiClient, AuthenticatedApiClient]
  gameId: number
  clock: ControlledClock
  turnProcessor: TurnProcessor
  turnsRepository: TurnsRepository
  target: Planet
  views: PlayerView[]
  defenderDistance: number
  stage: Awaited<ReturnType<typeof CapturedprocessTurnWithReplay>>
  attacker: Fleet
  defenderMoveId: string
}

type CreateWorkerInputSetupInput = {
  views: PlayerView[]
  composedActionId: string
  stage: Awaited<ReturnType<typeof CapturedprocessTurnWithReplay>>
  defenderJourney: Fleet
  target: Planet
  defenderStrength: number
  server: ConcurrencyTestApiServer
  clock: ControlledClock
  turnsRepository: TurnsRepository
  gameId: number
  attackerStrength: number
  preventedReason: string
  expectedSurvivingAttackerStrength: undefined | number
  expectedAttackerFleetCount: number
  expectedAttackerRemovalCount: number
  turnProcessor: TurnProcessor
  clients: readonly [AuthenticatedApiClient, AuthenticatedApiClient]
}

type CreateWorkerInputSetupResult = {
  workerInput: ReturnType<typeof reverseWorkerInputEnumeration>
  replay: ReturnType<typeof CapturedreplayWorkerInputWithState>
  loadedAttacker: ReturnType<typeof createFleetStub>
  loadedDefender: ReturnType<typeof createFleetStub>
  replayedTarget: undefined | ResolutionPlanet
  continuation: ResolvedTurnState["resolvedContinuations"][number]
  updatedAssertReplayedTarget: AssertReplayedTargetResult
}

type CreatePersistedAttackerSetupInput = {
  views: PlayerView[]
  loadedAttacker: ReturnType<typeof createFleetStub>
  expectedSurvivingAttackerStrength: undefined | number
  selectedInfluence: { uncommitted: number; total: number }
  composedActionId: string
  server: ConcurrencyTestApiServer
  gameId: number
  loadedDefender: ReturnType<typeof createFleetStub>
  expectedAttackerFleetCount: number
  target: Planet
  expectedAttackerAtTargetCount: number
  workerInput: ReturnType<typeof reverseWorkerInputEnumeration>
  replay: ReturnType<typeof CapturedreplayWorkerInputWithState>
}

type CreatePersistedAttackerSetupResult = {
  persistedAttacker: undefined | Fleet
  persistedFleetRows: Array<{
    id: FleetId
    gameId: GameId
    ownerPlayerId: PlayerId
    name: FleetName
    strength: number
    originPlanetId: PlanetId
    destinationPlanetId: null | PlanetId
    distanceToEnd: null | NonNegativeNumber
    movement: null | Readonly<{
      speed: PositiveNumber
      departureTurn: PositiveInteger
      submission: ReturnType<typeof createSubmittedActionStub>
      pendingArrivalEffects: readonly PendingArrivalEffect[]
    }>
  }>
  savedNextTurn: {
    gameId: GameId
    turn: number
    status: "COLLECTING_ACTIONS" | "AWAITING_PROCESSING" | "PROCESSING" | "COMPLETED"
    startedAt: ReturnType<typeof normalizeApiDate>
    endsAt: ReturnType<typeof normalizeApiDate>
    closedAt: null | ReturnType<typeof normalizeApiDate>
    rngGeneratorState: number
    rngSpareNormal: null | number
  }
  assertPersistedNextRngStatePhase4Value1: ResolvedTurnState
}

async function verifySelectedViews({
  clients,
  gameId,
  composedActionId,
  attacker,
  target,
  stage,
  server,
  clock,
  turnsRepository,
  turnProcessor,
  views,
}: VerifySelectedViewsInput): Promise<VerifySelectedViewsResult> {
  const selectedViews = await readViews(clients, gameId)
  expect(required(selectedViews[0]).actions.find(({ id }) => id === composedActionId)).toMatchObject({
    actionDefinitionId: ComposedSuccessAttackColonize.id,
    selectedTargets: { fleet: attacker.id, planet: target.id },
    selectedInputs: { strength: 50 },
  })
  expect(required(selectedViews[0]).resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 498, uncommitted: 473 })
  expect(required(selectedViews[0]).resources[ResourceType.FUEL]).toStrictEqual({ total: 100, uncommitted: 100 })

  stage = await processTurnWithReplay({
    server,
    clock,
    turnsRepository,
    turnProcessor,
    clients,
    gameId,
    turn: required(selectedViews[0]).turn,
  })
  views = stage.views

  return { stage, views }
}

function verifyPersistedNextRngState(input: VerifyPersistedNextRngStateInput): void {
  const persistedNextRngState = { generatorState: input.savedNextTurn.rngGeneratorState, spareNormal: input.savedNextTurn.rngSpareNormal }
  expect(persistedNextRngState).toStrictEqual(input.arrivalReplay.nextRngState)

  logReceipt("[C3-15 public composed success receipt]", {
    gameId: input.gameId,
    seed: 1,
    homes: [
      { id: input.homeA.id, coordinates: input.homeA.coordinates, x: input.homeA.x, y: input.homeA.y },
      { id: input.homeB.id, coordinates: input.homeB.coordinates, x: input.homeB.x, y: input.homeB.y },
    ],
    target: { id: input.target.id, coordinates: input.target.coordinates, x: input.target.x, y: input.target.y },
    distances: { attacker: input.attackerDistance, defender: input.defenderDistance },
    defender: { journeyId: input.defenderJourney.id, strength: 10, actualArrivalTick: 18, atTargetBeforeAttack: true },
    attacker: { journeyId: input.attackerJourney.id, strengthBeforeCombat: 50, actualArrivalTick: 6 },
    capturedEffectTypes: input.loadedDefinition.effects.map(({ type }) => type),
    capturedMappings: input.loadedDefinition.effects.map((effect) => ({ type: effect.type, targets: effect.targets })),
    outcomes: input.continuation.actionOutcomes,
    result: { owner: required(input.views[0]).player.id, strength: 20, defenderFleetRemoved: true },
    influence: { paidOnce: 25, remaining: required(input.views[0]).resources[ResourceType.INFLUENCE].total },
    rng: { preResolution: input.arrivalInput.rngState, replayNext: input.arrivalReplay.nextRngState, persistedNext: persistedNextRngState },
  })
}

function verifyPersistedAttacker(input: VerifyPersistedAttackerInput): void {
  assertPersistedNextRngState({
    ...input,
    ...input.persistedAttackerSetup5,
    expectedSurvivingAttackerStrength: input.expectedSurvivingAttackerStrength,
    replayedTarget: input.replayedTarget,
  })
}

type VerifySelectedViewsInput = {
  clients: readonly [AuthenticatedApiClient, AuthenticatedApiClient]
  gameId: number
  composedActionId: string
  attacker: Fleet
  target: Planet
  stage: Awaited<ReturnType<typeof CapturedprocessTurnWithReplay>>
  server: ConcurrencyTestApiServer
  clock: ControlledClock
  turnsRepository: TurnsRepository
  turnProcessor: TurnProcessor
  views: PlayerView[]
}

type VerifySelectedViewsResult = { stage: Awaited<ReturnType<typeof CapturedprocessTurnWithReplay>>; views: PlayerView[] }

type VerifyPersistedNextRngStateInput = {
  savedNextTurn: {
    gameId: GameId
    turn: number
    status: "COLLECTING_ACTIONS" | "AWAITING_PROCESSING" | "PROCESSING" | "COMPLETED"
    startedAt: ReturnType<typeof normalizeApiDate>
    endsAt: ReturnType<typeof normalizeApiDate>
    closedAt: null | ReturnType<typeof normalizeApiDate>
    rngGeneratorState: number
    rngSpareNormal: null | number
  }
  arrivalReplay: ReturnType<typeof CapturedreplayWorkerInputWithState>
  gameId: number
  homeA: Planet
  homeB: Planet
  target: Planet
  attackerDistance: number
  defenderDistance: number
  defenderJourney: Fleet
  attackerJourney: Fleet
  loadedDefinition: Readonly<{
    id: ActionDefinitionId
    name: string
    type: ActionType
    tier: ActionTier
    inputs: Readonly<Record<InputTag, Readonly<{ type: "POSITIVE_INTEGER"; label: string }>>>
    targets: Readonly<
      Record<
        TargetTag,
        Readonly<{
          targetType: TargetType
          constraints: ReadonlyArray<
            | { type: "OWNED_BY_SUBMITTING_PLAYER"; references: Record<string, never>; parameters: Record<string, never> }
            | { type: "STATIONARY_FLEET"; references: Record<string, never>; parameters: Record<string, never> }
            | { type: "WITHIN_FLEET_RANGE"; references: { sourceFleetTag: TargetTag }; parameters: { maxDistance: PositiveNumber } }
            | { type: "DIFFERENT_FROM_FLEET_ORIGIN"; references: { sourceFleetTag: TargetTag }; parameters: Record<string, never> }
            | { type: "AT_FLEET_PLANET"; references: { sourceFleetTag: TargetTag }; parameters: Record<string, never> }
            | { type: "UNCLAIMED_PLANET"; references: Record<string, never>; parameters: Record<string, never> }
          >
        }>
      >
    >
    costs: ResourceLossEffectDefinition[]
    effects: Array<
      | {
          type: "FLEET_ASSAULT"
          targets: { fleet: EffectDefinitionTargetDefinition<"FLEET">; planet: EffectDefinitionTargetDefinition<"PLANET"> }
          parameters: Record<string, never>
        }
      | {
          type: "FLEET_COLONIZE"
          targets: { fleet: EffectDefinitionTargetDefinition<"FLEET">; planet: EffectDefinitionTargetDefinition<"PLANET"> }
          parameters: { strengthRequirement: PositiveInteger }
        }
      | {
          type: "RESOURCE_LOSS"
          targets: Record<string, never>
          parameters: Readonly<{ quantity: PositiveNumber; resourceType: "INFLUENCE" | "METAL" | "FUEL" | "ENERGY" | "COLONY" }>
        }
      | {
          type: "RESOURCE_GAIN"
          targets: Record<string, never>
          parameters: Readonly<{ quantity: PositiveNumber; resourceType: "INFLUENCE" | "METAL" | "FUEL" | "ENERGY" | "COLONY" }>
        }
      | { type: "VICTORY"; targets: Record<string, never>; parameters: Record<string, never> }
      | { type: "FLEET_BUILD"; targets: { planet: EffectDefinitionTargetDefinition<"PLANET"> }; parameters: { strength: PositiveInteger } }
      | {
          type: "FLEET_MOVE"
          targets: { fleet: EffectDefinitionTargetDefinition<"FLEET">; planet: EffectDefinitionTargetDefinition<"PLANET"> }
          inputs: { strength: { actionInputTag: InputTag; inputType: "POSITIVE_INTEGER" } }
          parameters: { speed: PositiveNumber }
        }
    >
  }>
  continuation: ResolvedTurnState["resolvedContinuations"][number]
  views: PlayerView[]
  arrivalInput: ReturnType<typeof reverseWorkerInputEnumeration>
}

type VerifyPersistedAttackerInput = {
  persistedAttackerSetup5: CreatePersistedAttackerSetupResult
  replay: ReturnType<typeof CapturedreplayWorkerInputWithState>
  gameId: number
  target: Planet
  defenderDistance: number
  attackerStrength: number
  defenderStrength: number
  expectedSurvivingAttackerStrength: undefined | number
  composedActionId: string
  replayedTarget: undefined | ResolutionPlanet
  loadedAttacker: ReturnType<typeof createFleetStub>
  loadedDefender: ReturnType<typeof createFleetStub>
  continuation: ResolvedTurnState["resolvedContinuations"][number]
  views: PlayerView[]
}

async function prepareViewsScenario(input: PrepareViewsScenarioInput): Promise<PrepareViewsScenarioResult> {
  const viewsSetup1 = await createViewsSetup({ ...input })
  const { attacker, defenderJourney } = viewsSetup1
  let { views, stage } = viewsSetup1
  expect(defenderJourney.distanceToEnd).toBeCloseTo(8.852953053708077, 12)
  expect(getPlanets(required(views[0])).find(({ id }) => id === input.target.id)?.ownerPlayerId).toBeNull()

  stage = await processTurnWithReplay({ ...input, turn: required(views[0]).turn })
  views = stage.views
  expect(stage.resolved.fleets[defenderJourney.id]?.arrivedAtTick).toBe(18)
  const defender = getFleetAt(required(views[1]), required(views[1]).player.id, input.target.id, 10)
  expect(getPlanets(required(views[0])).find(({ id }) => id === input.target.id)?.ownerPlayerId).toBeNull()
  expect(required(views[1]).resources[ResourceType.INFLUENCE].total).toBe(495)
  expect(required(views[1]).resources[ResourceType.FUEL].total).toBe(95)
  return { viewsSetup1, attacker, views, stage, defender }
}

async function prepareAliceScenario(input: PrepareAliceScenarioInput): Promise<PrepareAliceScenarioResult> {
  const aliceSetup3 = await createAliceSetup({ ...input })
  const { alice, clients, gameId, clock, turnProcessor, turnsRepository, target, attacker, defenderMoveId } = aliceSetup3
  let { views, stage } = aliceSetup3
  stage = await processTurnWithReplay({
    server: input.server,
    clock,
    turnsRepository,
    turnProcessor,
    clients,
    gameId,
    turn: required(views[0]).turn,
  })
  views = stage.views
  const defenderJourney = required(views[1]).fleets.find(({ movement }) => movement?.submission.id === defenderMoveId)
  Assert.isDefined(defenderJourney)
  expect(defenderJourney.distanceToEnd).toBeCloseTo(8.852953053708077, 12)

  expect(getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()
  return {
    aliceSetup3,
    alice,
    clients,
    gameId,
    clock,
    turnProcessor,
    turnsRepository,
    target,
    attacker,
    views,
    stage,
    defenderJourney,
  }
}

type PrepareViewsScenarioInput = {
  fixture: Awaited<ReturnType<typeof CapturedcreatePublicTwoPlayerFixture>>
  homeA: Planet
  target: Planet
  homeB: Planet
  alice: AuthenticatedApiClient
  gameId: number
  bob: AuthenticatedApiClient
  server: ConcurrencyTestApiServer
  clock: ControlledClock
  turnsRepository: TurnsRepository
  turnProcessor: TurnProcessor
  clients: readonly [AuthenticatedApiClient, AuthenticatedApiClient]
}

type PrepareViewsScenarioResult = {
  viewsSetup1: CreateViewsSetupResult
  attacker: Fleet
  views: PlayerView[]
  stage: Awaited<ReturnType<typeof CapturedprocessTurnWithReplay>>
  defender: Fleet
}

type PrepareAliceScenarioInput = {
  server: ConcurrencyTestApiServer
  attackerBuildDefinitionId: ActionDefinitionId
  defenderBuildDefinitionId: ActionDefinitionId
  attackerStrength: number
  defenderStrength: number
}

type PrepareAliceScenarioResult = {
  aliceSetup3: CreateAliceSetupResult
  alice: AuthenticatedApiClient
  clients: readonly [AuthenticatedApiClient, AuthenticatedApiClient]
  gameId: number
  clock: ControlledClock
  turnProcessor: TurnProcessor
  turnsRepository: TurnsRepository
  target: Planet
  attacker: Fleet
  views: PlayerView[]
  stage: Awaited<ReturnType<typeof CapturedprocessTurnWithReplay>>
  defenderJourney: Fleet
}
