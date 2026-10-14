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
    await using server = await ConcurrencyTestApiServer.create()
    const fixture = await createPublicTwoPlayerFixture(server)
    const { alice, bob, clients, gameId, clock, turnProcessor, turnsRepository, homeA, homeB, target } = fixture

    const createCreateViewsSetupPhase1ResultSetupPhase1Result = await createCreateViewsSetupResultSetup({
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
    const { createViewsSetupPhase1Result, attacker } = createCreateViewsSetupPhase1ResultSetupPhase1Result
    let { views } = createCreateViewsSetupPhase1ResultSetupPhase1Result

    const composedActionId = await submitAction({
      client: alice.client,
      gameId,
      view: required(views[0]),
      actionDefinitionId: ComposedSuccessAttackColonize.id,
      selectedTargets: { fleet: attacker.id, planet: target.id },
      selectedInputs: { strength: 50 },
    })

    const updatedVerifySelectedViews = await verifySelectedViews({
      ...createCreateViewsSetupPhase1ResultSetupPhase1Result,
      ...createViewsSetupPhase1Result,
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

    const createAttackerJourneySetupPhase2Result = await createAttackerJourneySetup({
      ...createCreateViewsSetupPhase1ResultSetupPhase1Result,
      ...createViewsSetupPhase1Result,
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
    const { arrivalTurn, updatedAssertContinuation } = createAttackerJourneySetupPhase2Result
    views = updatedAssertContinuation.views

    const savedTurns = await server.database
      .select()
      .from(turnsTable)
      .where(eq(turnsTable.gameId, typedParse(GameIdSchema, gameId)))
    const savedNextTurn = savedTurns.find(({ turn }) => turn === arrivalTurn + 1)
    Assert.isDefined(savedNextTurn)

    verifyPersistedNextRngState({
      ...createViewsSetupPhase1Result,
      ...createAttackerJourneySetupPhase2Result,
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

      const createCreateAliceSetupPhase3ResultSetupPhase2Result = await createCreateAliceSetupResultSetup({
        server,
        attackerBuildDefinitionId,
        defenderBuildDefinitionId,
        attackerStrength,
        defenderStrength,
      })
      const { createAliceSetupPhase3Result, alice, clients, gameId, clock, turnProcessor, turnsRepository, target, attacker } =
        createCreateAliceSetupPhase3ResultSetupPhase2Result
      let { views, stage } = createCreateAliceSetupPhase3ResultSetupPhase2Result
      // Act & Assert
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

      const createWorkerInputSetupPhase4Result = await createWorkerInputSetup({
        ...createCreateAliceSetupPhase3ResultSetupPhase2Result,
        ...createAliceSetupPhase3Result,
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
      const { updatedAssertReplayedTarget } = createWorkerInputSetupPhase4Result
      views = updatedAssertReplayedTarget.views

      const createPersistedAttackerSetupPhase5Result = await createPersistedAttackerSetup({
        ...createAliceSetupPhase3Result,
        ...createWorkerInputSetupPhase4Result,
        views,
        expectedSurvivingAttackerStrength,
        selectedInfluence,
        composedActionId,
        server,
        expectedAttackerFleetCount,
        expectedAttackerAtTargetCount,
      })

      verifyPersistedAttacker({
        ...createAliceSetupPhase3Result,
        ...createWorkerInputSetupPhase4Result,
        createPersistedAttackerSetupPhase5Result,
        attackerStrength,
        defenderStrength,
        expectedSurvivingAttackerStrength,
        composedActionId,
        views,
      })
    },
  )
})

async function createViewsSetup({
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
}: CreateViewsSetupInput): Promise<CreateViewsSetupResult> {
  let views = fixture.views
  const attackerDistance = Math.hypot(homeA.x - target.x, homeA.y - target.y)
  const defenderDistance = Math.hypot(homeB.x - target.x, homeB.y - target.y)
  expect(attackerDistance).toBeCloseTo(1.2645395167985714, 12)
  expect(defenderDistance).toBeCloseTo(18.852953053708077, 12)
  expect(target.ownerPlayerId).toBeNull()

  await submitAction({
    client: alice.client,
    gameId,
    view: required(views[0]),
    actionDefinitionId: BuildFleet50.id,
    selectedTargets: { planet: homeA.id },
    selectedInputs: {},
  })
  await submitAction({
    client: bob.client,
    gameId,
    view: required(views[1]),
    actionDefinitionId: BuildFleet10ForStaging.id,
    selectedTargets: { planet: homeB.id },
    selectedInputs: {},
  })
  let stage = await processTurnWithReplay({
    server,
    clock,
    turnsRepository,
    turnProcessor,
    clients,
    gameId,
    turn: required(views[0]).turn,
  })
  views = stage.views
  const attacker = getFleetAt(required(views[0]), required(views[0]).player.id, homeA.id, 50)
  const defenderSource = getFleetAt(required(views[1]), required(views[1]).player.id, homeB.id, 10)
  expect(views.map(({ resources }) => resources[ResourceType.INFLUENCE].total)).toStrictEqual([498, 498])
  expect(views.map(({ resources }) => resources[ResourceType.METAL].total)).toStrictEqual([99, 99])

  const defenderMoveId = await submitAction({
    client: bob.client,
    gameId,
    view: required(views[1]),
    actionDefinitionId: MoveFleetSpeed10.id,
    selectedTargets: { fleet: defenderSource.id, planet: target.id },
    selectedInputs: { strength: 10 },
  })
  stage = await processTurnWithReplay({ server, clock, turnsRepository, turnProcessor, clients, gameId, turn: required(views[0]).turn })
  views = stage.views
  const defenderJourney = required(views[1]).fleets.find(({ movement }) => movement?.submission.id === defenderMoveId)
  Assert.isDefined(defenderJourney)
  return { views, attackerDistance, defenderDistance, stage, attacker, defenderJourney }
}

async function createAttackerJourneySetup({
  views,
  composedActionId,
  attacker,
  defender,
  target,
  server,
  clock,
  turnsRepository,
  gameId,
  alice,
  bob,
  turnProcessor,
  clients,
}: CreateAttackerJourneySetupInput): Promise<CreateAttackerJourneySetupResult> {
  const attackerJourney = required(views[0]).fleets.find(({ movement }) => movement?.submission.id === composedActionId)
  Assert.isDefined(attackerJourney)
  expect(attackerJourney.distanceToEnd).toBeCloseTo(0.2645395167985714, 12)
  expect(required(views[0]).fleets.find(({ id }) => id === attacker.id)).toBeUndefined()
  expect(required(views[1]).fleets.find(({ id }) => id === defender.id)?.strength).toBe(10)
  expect(getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()

  const arrivalTurn = required(views[0]).turn
  const arrivalInput = await captureWorkerInput({ server, clock, turnsRepository, gameId, turn: arrivalTurn })
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

  assertLoadedJourney2({ loadedJourney, attackerJourney, alice, target, composedActionId, attacker, arrivalInput, defender, bob })

  Assert.isSuccess(arrivalReplay.resolved)
  const continuation = arrivalReplay.resolved.value.resolvedContinuations.find(
    ({ originatingSubmission }) => originatingSubmission.id === composedActionId,
  )
  Assert.isDefined(continuation)

  Assert.isSuccess(arrivalReplay.resolved)
  const assertAssertContinuationState2ResolvedPhase2Value1 = arrivalReplay.resolved.value

  const updatedAssertContinuation = await assertContinuation({
    assertAssertContinuationState2ResolvedPhase2Value1,
    continuation,
    defender,
    attackerJourney,
    alice,
    target,
    arrivalReplay,
    arrivalInput,
    turnProcessor,
    views,
    clients,
    gameId,
    arrivalTurn,
    composedActionId,
  })
  return { attackerJourney, arrivalTurn, arrivalInput, arrivalReplay, loadedDefinition, continuation, updatedAssertContinuation }
}

async function createAliceSetup({
  server,
  attackerBuildDefinitionId,
  defenderBuildDefinitionId,
  attackerStrength,
  defenderStrength,
}: CreateAliceSetupInput): Promise<CreateAliceSetupResult> {
  const fixture = await createPublicTwoPlayerFixture(server)
  const { alice, bob, clients, gameId, clock, turnProcessor, turnsRepository, homeA, homeB, target } = fixture
  let views = fixture.views
  const defenderDistance = Math.hypot(homeB.x - target.x, homeB.y - target.y)
  expect(defenderDistance).toBeCloseTo(18.852953053708077, 12)
  expect(target.ownerPlayerId).toBeNull()

  await submitAction({
    client: alice.client,
    gameId,
    view: required(views[0]),
    actionDefinitionId: attackerBuildDefinitionId,
    selectedTargets: { planet: homeA.id },
    selectedInputs: {},
  })
  await submitAction({
    client: bob.client,
    gameId,
    view: required(views[1]),
    actionDefinitionId: defenderBuildDefinitionId,
    selectedTargets: { planet: homeB.id },
    selectedInputs: {},
  })
  const stage = await processTurnWithReplay({
    server,
    clock,
    turnsRepository,
    turnProcessor,
    clients,
    gameId,
    turn: required(views[0]).turn,
  })
  views = stage.views
  const attacker = getFleetAt(required(views[0]), required(views[0]).player.id, homeA.id, attackerStrength)
  const defenderSource = getFleetAt(required(views[1]), required(views[1]).player.id, homeB.id, defenderStrength)
  const defenderMoveId = await submitAction({
    client: bob.client,
    gameId,
    view: required(views[1]),
    actionDefinitionId: MoveFleetSpeed10.id,
    selectedTargets: { fleet: defenderSource.id, planet: target.id },
    selectedInputs: { strength: defenderStrength },
  })
  return { alice, clients, gameId, clock, turnProcessor, turnsRepository, target, views, defenderDistance, stage, attacker, defenderMoveId }
}

async function createWorkerInputSetup({
  views,
  composedActionId,
  stage,
  defenderJourney,
  target,
  defenderStrength,
  server,
  clock,
  turnsRepository,
  gameId,
  attackerStrength,
  preventedReason,
  expectedSurvivingAttackerStrength,
  expectedAttackerFleetCount,
  expectedAttackerRemovalCount,
  turnProcessor,
  clients,
}: CreateWorkerInputSetupInput): Promise<CreateWorkerInputSetupResult> {
  const arrivingJourney = required(views[0]).fleets.find(({ movement }) => movement?.submission.id === composedActionId)
  Assert.isDefined(arrivingJourney)
  expect(arrivingJourney.distanceToEnd).toBeCloseTo(0.2645395167985714, 12)
  expect(stage.resolved.fleets[defenderJourney.id]?.arrivedAtTick).toBe(18)
  expect(getFleetAt(required(views[1]), required(views[1]).player.id, target.id, defenderStrength).id).toBe(defenderJourney.id)
  expect(getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()

  const workerInput = await captureWorkerInput({ server, clock, turnsRepository, gameId, turn: required(views[0]).turn })
  const replay = replayWorkerInputWithState(workerInput)
  Assert.isSuccess(replay.resolved)
  const loadedAttacker = Object.values(workerInput.fleets).find(({ movement }) => movement?.submission.id === composedActionId)
  Assert.isDefined(loadedAttacker)
  const loadedDefender = workerInput.fleets[defenderJourney.id]
  Assert.isDefined(loadedDefender)
  expect(loadedAttacker).toMatchObject({ strength: attackerStrength, movement: { submission: { id: composedActionId } } })
  expect(loadedDefender).toMatchObject({ strength: defenderStrength, originPlanetId: target.id })
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
  const replayedTarget = replay.resolved.value.planets[target.id]
  Assert.isSuccess(replay.resolved)
  const continuation = replay.resolved.value.resolvedContinuations.find(
    ({ originatingSubmission }) => originatingSubmission.id === composedActionId,
  )
  Assert.isDefined(continuation)

  Assert.isSuccess(replay.resolved)
  const assertAssertReplayedTargetState1ResolvedPhase3Value1 = replay.resolved.value

  const updatedAssertReplayedTarget = await assertReplayedTarget({
    assertAssertReplayedTargetState1ResolvedPhase3Value1,
    replayedTarget,
    continuation,
    defenderStrength,
    preventedReason,
    loadedAttacker,
    expectedSurvivingAttackerStrength,
    loadedDefender,
    expectedAttackerFleetCount,
    expectedAttackerRemovalCount,
    turnProcessor,
    views,
    clients,
    gameId,
    target,
  })
  return { workerInput, replay, loadedAttacker, loadedDefender, replayedTarget, continuation, updatedAssertReplayedTarget }
}

async function createPersistedAttackerSetup({
  views,
  loadedAttacker,
  expectedSurvivingAttackerStrength,
  selectedInfluence,
  composedActionId,
  server,
  gameId,
  loadedDefender,
  expectedAttackerFleetCount,
  target,
  expectedAttackerAtTargetCount,
  workerInput,
  replay,
}: CreatePersistedAttackerSetupInput): Promise<CreatePersistedAttackerSetupResult> {
  const persistedAttacker = required(views[0]).fleets.find(({ id }) => id === loadedAttacker.id)
  expect(persistedAttacker?.strength).toBe(expectedSurvivingAttackerStrength)

  expect(persistedAttacker?.movement).toBeUndefined()
  expect(persistedAttacker?.destinationPlanetId).toBeUndefined()
  expect(required(views[0]).resources[ResourceType.INFLUENCE]).toStrictEqual({
    total: selectedInfluence.total - 25,
    uncommitted: selectedInfluence.total - 25,
  })
  expect(required(views[0]).resources[ResourceType.COLONY]).toStrictEqual({ total: 0, uncommitted: 0 })
  expect(required(views[0]).actions.find(({ id }) => id === composedActionId)).toMatchObject({
    selectedTargets: null,
    isInProgress: false,
  })

  const persistedFleetRows = await server.database
    .select()
    .from(fleetsTable)
    .where(eq(fleetsTable.gameId, typedParse(GameIdSchema, gameId)))
  expect(persistedFleetRows.find(({ id }) => id === loadedDefender.id)).toBeUndefined()
  expect(persistedFleetRows.find(({ id }) => id === loadedAttacker.id)?.strength).toBe(expectedSurvivingAttackerStrength)
  expect(persistedFleetRows.filter(({ id }) => id === loadedAttacker.id)).toHaveLength(expectedAttackerFleetCount)
  expect(
    persistedFleetRows.filter(({ id }) => id === loadedAttacker.id).filter(({ originPlanetId }) => originPlanetId === target.id),
  ).toHaveLength(expectedAttackerAtTargetCount)
  const savedTurns = await server.database
    .select()
    .from(turnsTable)
    .where(eq(turnsTable.gameId, typedParse(GameIdSchema, gameId)))
  const savedNextTurn = savedTurns.find(({ turn }) => turn === workerInput.turn + 1)
  Assert.isDefined(savedNextTurn)

  Assert.isSuccess(replay.resolved)
  const assertPersistedNextRngStatePhase4Value1 = replay.resolved.value
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

function verifyPersistedNextRngState({
  savedNextTurn,
  arrivalReplay,
  gameId,
  homeA,
  homeB,
  target,
  attackerDistance,
  defenderDistance,
  defenderJourney,
  attackerJourney,
  loadedDefinition,
  continuation,
  views,
  arrivalInput,
}: VerifyPersistedNextRngStateInput): void {
  const persistedNextRngState = { generatorState: savedNextTurn.rngGeneratorState, spareNormal: savedNextTurn.rngSpareNormal }
  expect(persistedNextRngState).toStrictEqual(arrivalReplay.nextRngState)

  logReceipt("[C3-15 public composed success receipt]", {
    gameId,
    seed: 1,
    homes: [
      { id: homeA.id, coordinates: homeA.coordinates, x: homeA.x, y: homeA.y },
      { id: homeB.id, coordinates: homeB.coordinates, x: homeB.x, y: homeB.y },
    ],
    target: { id: target.id, coordinates: target.coordinates, x: target.x, y: target.y },
    distances: { attacker: attackerDistance, defender: defenderDistance },
    defender: { journeyId: defenderJourney.id, strength: 10, actualArrivalTick: 18, atTargetBeforeAttack: true },
    attacker: { journeyId: attackerJourney.id, strengthBeforeCombat: 50, actualArrivalTick: 6 },
    capturedEffectTypes: loadedDefinition.effects.map(({ type }) => type),
    capturedMappings: loadedDefinition.effects.map((effect) => ({ type: effect.type, targets: effect.targets })),
    outcomes: continuation.actionOutcomes,
    result: { owner: required(views[0]).player.id, strength: 20, defenderFleetRemoved: true },
    influence: { paidOnce: 25, remaining: required(views[0]).resources[ResourceType.INFLUENCE].total },
    rng: { preResolution: arrivalInput.rngState, replayNext: arrivalReplay.nextRngState, persistedNext: persistedNextRngState },
  })
}

function verifyPersistedAttacker({
  createPersistedAttackerSetupPhase5Result,
  replay,
  gameId,
  target,
  defenderDistance,
  attackerStrength,
  defenderStrength,
  expectedSurvivingAttackerStrength,
  composedActionId,
  replayedTarget,
  loadedAttacker,
  loadedDefender,
  continuation,
  views,
}: VerifyPersistedAttackerInput): void {
  assertPersistedNextRngState({
    ...createPersistedAttackerSetupPhase5Result,
    replay,
    gameId,
    target,
    defenderDistance,
    attackerStrength,
    defenderStrength,
    expectedSurvivingAttackerStrength,
    composedActionId,
    replayedTarget,
    loadedAttacker,
    loadedDefender,
    continuation,
    views,
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
  createPersistedAttackerSetupPhase5Result: CreatePersistedAttackerSetupResult
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

async function createCreateViewsSetupResultSetup({
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
}: CreateCreateViewsSetupResultSetupInput): Promise<CreateCreateViewsSetupResultSetupResult> {
  const createViewsSetupPhase1Result = await createViewsSetup({
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
  const { attacker, defenderJourney } = createViewsSetupPhase1Result
  let { views, stage } = createViewsSetupPhase1Result
  expect(defenderJourney.distanceToEnd).toBeCloseTo(8.852953053708077, 12)
  expect(getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()

  stage = await processTurnWithReplay({ server, clock, turnsRepository, turnProcessor, clients, gameId, turn: required(views[0]).turn })
  views = stage.views
  expect(stage.resolved.fleets[defenderJourney.id]?.arrivedAtTick).toBe(18)
  const defender = getFleetAt(required(views[1]), required(views[1]).player.id, target.id, 10)
  expect(getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()
  expect(required(views[1]).resources[ResourceType.INFLUENCE].total).toBe(495)
  expect(required(views[1]).resources[ResourceType.FUEL].total).toBe(95)
  return { createViewsSetupPhase1Result, attacker, views, stage, defender }
}

async function createCreateAliceSetupResultSetup({
  server,
  attackerBuildDefinitionId,
  defenderBuildDefinitionId,
  attackerStrength,
  defenderStrength,
}: CreateCreateAliceSetupResultSetupInput): Promise<CreateCreateAliceSetupResultSetupResult> {
  const createAliceSetupPhase3Result = await createAliceSetup({
    server,
    attackerBuildDefinitionId,
    defenderBuildDefinitionId,
    attackerStrength,
    defenderStrength,
  })
  const { alice, clients, gameId, clock, turnProcessor, turnsRepository, target, attacker, defenderMoveId } = createAliceSetupPhase3Result
  let { views, stage } = createAliceSetupPhase3Result
  stage = await processTurnWithReplay({
    server,
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
    createAliceSetupPhase3Result,
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

type CreateCreateViewsSetupResultSetupInput = {
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

type CreateCreateViewsSetupResultSetupResult = {
  createViewsSetupPhase1Result: CreateViewsSetupResult
  attacker: Fleet
  views: PlayerView[]
  stage: Awaited<ReturnType<typeof CapturedprocessTurnWithReplay>>
  defender: Fleet
}

type CreateCreateAliceSetupResultSetupInput = {
  server: ConcurrencyTestApiServer
  attackerBuildDefinitionId: ActionDefinitionId
  defenderBuildDefinitionId: ActionDefinitionId
  attackerStrength: number
  defenderStrength: number
}

type CreateCreateAliceSetupResultSetupResult = {
  createAliceSetupPhase3Result: CreateAliceSetupResult
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
