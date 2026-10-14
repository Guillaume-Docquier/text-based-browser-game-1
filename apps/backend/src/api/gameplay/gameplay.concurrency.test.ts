import { type RngState, Assert, branded, Logger, Time, UnitOfTime, type DeepUnbranded } from "@guillaume-docquier/tools-ts"
import { eq } from "drizzle-orm"
import { createGameConfigurationStub } from "shared/domain/games/GameConfiguration.stub.ts"
import type { GameId } from "shared/domain/games/GameId.ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import type { ActionDefinitionId } from "shared/domain/ruleset/action-definitions/ActionDefinitionId.ts"
import type { PlanetId } from "shared/domain/world/planets/PlanetId.ts"
import { ColonizeHereTest } from "shared/testing/test-ruleset/action-definitions/colonize.ts"
import { describe, expect, it } from "vitest"
import type { SubmittedActionTargetsDto } from "#api/gameplay/SubmittedActionTargetsDto.ts"
import type { SelectedTargets, SelectedInputs, Planet, Fleet, PlayerView } from "#api/types.ts"
import { ControlledClock } from "#lib/ControlledClock.ts"
import { TransactionRollbackError } from "#lib/db/drizzle/TransactionRollbackError.ts"
import { turnsTable } from "#lib/db/schema.ts"
import { RulesetsRepository } from "#lib/rulesets/rulesets.repository.ts"
import type { AuthenticatedApiClient } from "#tests/ApiClient.ts"
import { ConcurrencyTestApiServer } from "#tests/ConcurrencyTestApiServer.ts"
import type {
  createObservedPreResolutionRngStateSetup as CapturedcreateObservedPreResolutionRngStateSetup,
  createClockSetup as CapturedcreateClockSetup,
  createHomeASetup as CapturedcreateHomeASetup,
  createViewsSetup as CapturedcreateViewsSetup,
  createPriorityTurnSetup as CapturedcreatePriorityTurnSetup,
} from "#tests/fleet-assertions/gameplay.stages.ts"
import type { normalizeApiDate } from "#tests/fleet-concurrency/gameplay.scenarios.ts"
import type { reverseWorkerInputEnumeration, replayWorkerInput } from "#tests/fleet-concurrency/gameplay.ts"
import { createTurnProcessorStub } from "#turn-processing/TurnProcessor.stub.ts"
import type { TurnProcessor } from "#turn-processing/TurnProcessor.ts"
import type { TurnsRepository, TurnToProcessModel } from "#turn-processing/turns.repository.ts"
import { createPersistedAliceSetup } from "../../tests/fleet-assertions/gameplay.stages-2.ts"
import {
  createClockSetup,
  createHomeASetup,
  createObservedPreResolutionRngStateSetup,
  createViewsSetup,
  createPriorityTurnSetup,
  createCapturedInputSetup,
} from "../../tests/fleet-assertions/gameplay.stages.ts"
import { assertUntouchedAfter, assertPersistedNextRngState } from "../../tests/fleet-assertions/gameplay.ts"
import { markManualDeadlineDue, processManualDeadlineTurn } from "../../tests/fleet-concurrency/gameplay.scenarios.ts"
import {
  MANUAL_WORKER_TURN_INTERVAL,
  PostgresColonizeTickZeroPriorityRuleset,
  publicTickZeroPriorityScenarios,
  findStationaryFleetAt,
  tieWinnerForce,
} from "../../tests/fleet-concurrency/gameplay.ts"

describe("gameplay submission concurrency", () => {
  it("should persist a natural tick-zero Colonize tie through the public worker and reload", async () => {
    await using server = await ConcurrencyTestApiServer.create()

    const createClockSetupPhase1Result = await createClockSetup({ server })
    const { clock, alice, bob, gameId, turnProcessor, turnsRepository, clients } = createClockSetupPhase1Result
    const readViews = async (): Promise<[PlayerView, PlayerView]> =>
      await Promise.all([alice.client.gameplay.getPlayerView.query({ gameId }), bob.client.gameplay.getPlayerView.query({ gameId })])
    const submit = async (
      client: AuthenticatedApiClient["client"],
      view: PlayerView,
      actionDefinitionId: ActionDefinitionId,
      selectedTargets: DeepUnbranded<SubmittedActionTargetsDto["selectedTargets"]>,
      selectedInputs: DeepUnbranded<SubmittedActionTargetsDto["selectedInputs"]>,
    ): Promise<string> => {
      const action = view.actions.find(({ actionDefinitionId: definitionId }) => definitionId === actionDefinitionId)
      Assert.isDefined(action)
      await client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: view.turn,
        submittedActionTargets: { actionId: action.id, selectedTargets, selectedInputs },
      })
      return action.id
    }
    const processDeadlineTurn = async (turn: number): Promise<void> => {
      await processManualDeadlineTurn({ clock, turnProcessor, turnsRepository, client: alice.client, gameId, turn })
    }

    const createHomeASetupPhase2Result = await createHomeASetup({ ...createClockSetupPhase1Result, readViews, submit, processDeadlineTurn })
    const { target, stationedViews } = createHomeASetupPhase2Result
    const stationedFleets = clients.map(({ account }, index) => {
      const view = stationedViews[index]
      Assert.isDefined(view)
      return findStationaryFleetAt(view, branded<PlayerId>(account.id), target.id)
    })
    const stationedA = stationedFleets[0]
    const stationedB = stationedFleets[1]
    Assert.isDefined(stationedA)
    Assert.isDefined(stationedB)
    expect([stationedA.strength, stationedB.strength]).toStrictEqual([35, 35])
    for (const view of stationedViews) {
      expect(view.galaxy.systems.flatMap(({ planets }) => planets).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()
      expect(view.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 50, uncommitted: 50 })
      expect(view.resources[ResourceType.FUEL]).toStrictEqual({ total: 1, uncommitted: 1 })
    }

    const colonizeActionIds: string[] = []
    for (let ownerIndex = 0; ownerIndex < clients.length; ownerIndex += 1) {
      const client = clients[ownerIndex]
      const view = stationedViews[ownerIndex]
      const fleet = stationedFleets[ownerIndex]
      Assert.isDefined(client)
      Assert.isDefined(view)
      Assert.isDefined(fleet)
      colonizeActionIds.push(await submit(client.client, view, ColonizeHereTest.id, { fleet: fleet.id, planet: target.id }, {}))
      const selected = await client.client.gameplay.getPlayerView.query({ gameId })
      expect(selected.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 50, uncommitted: 25 })
    }

    const observationView = await alice.client.gameplay.getPlayerView.query({ gameId })
    await markManualDeadlineDue({ clock, turnsRepository })
    let observed: TurnToProcessModel | undefined
    const rollbackMessage = `Intentional C3-10 worker input observation rollback for game ${gameId}`
    await expect(
      server.database.transaction(async (tx) => {
        const turn = await turnsRepository.getNextTurnForProcessing({ since: clock.now() }, tx)
        Assert.isDefined(turn)
        expect(turn.gameId).toBe(gameId)
        expect(turn.turn).toBe(observationView.turn)
        observed = structuredClone(await turnsRepository.startTurnProcessing({ turn, processingStartedAt: clock.now() }, tx))
        throw new TransactionRollbackError(rollbackMessage)
      }),
    ).rejects.toMatchObject({ name: "TransactionRollbackError", message: rollbackMessage })
    Assert.isDefined(observed)

    const createCreateObservedPreResolutionRngStateSetupPhase3ResultSetupPhase1Result =
      await createCreateObservedPreResolutionRngStateSetupResultSetup({
        createClockSetupPhase1Result,
        createHomeASetupPhase2Result,
        observed,
        colonizeActionIds,
        stationedFleets,
      })
    const { createObservedPreResolutionRngStateSetupPhase3Result, aliceAfter, bobAfter } =
      createCreateObservedPreResolutionRngStateSetupPhase3ResultSetupPhase1Result
    for (const view of [aliceAfter, bobAfter]) {
      expect(view.turn).toBe(observationView.turn + 1)
      expect(view.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 25, uncommitted: 25 })
      expect(view.resources[ResourceType.METAL]).toStrictEqual({ total: 4, uncommitted: 4 })
      expect(view.resources[ResourceType.FUEL]).toStrictEqual({ total: 1, uncommitted: 1 })
      expect(view.resources[ResourceType.COLONY]).toStrictEqual({ total: 0, uncommitted: 0 })
      for (const actionId of colonizeActionIds) {
        expect(view.actions.find(({ id }) => id === actionId)).toMatchObject({ selectedTargets: null, isInProgress: false })
      }
    }

    const savedTurns = await server.database.select().from(turnsTable).where(eq(turnsTable.gameId, gameId))
    const savedNextTurn = savedTurns.find(({ turn }) => turn === observationView.turn + 1)
    Assert.isDefined(savedNextTurn)

    await assertUntouchedAfterObserved({
      ...createCreateObservedPreResolutionRngStateSetupPhase3ResultSetupPhase1Result,
      ...createClockSetupPhase1Result,
      ...createHomeASetupPhase2Result,
      ...createObservedPreResolutionRngStateSetupPhase3Result,
      observed,
      savedNextTurn,
      observationView,
    })
  })

  it.each(publicTickZeroPriorityScenarios)(
    "should prefer valid stationary tick-zero Colonize over a positive-tick arrival with $label",
    async ({ movingStrength, buildActionDefinitionId, builtStrength, bobHomeRemainderStrengths }) => {
      // Arrange
      await using server = await ConcurrencyTestApiServer.create()
      const rulesetsRepository = new RulesetsRepository({ db: server.database, logger: Logger.get() })
      Assert.isSuccess(await rulesetsRepository.upsertRuleset(PostgresColonizeTickZeroPriorityRuleset))
      const alice = await server.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000061" })
      const bob = await server.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000062" })
      const { createdGameId: gameId } = await alice.client.games.create.mutate({
        configuration: createGameConfigurationStub({
          rulesetId: PostgresColonizeTickZeroPriorityRuleset.id,
          nbSeats: 2,
          turnIntervalSeconds: Time.in(MANUAL_WORKER_TURN_INTERVAL, UnitOfTime.SECONDS),
          mapGenerationSeed: 147,
        }),
      })
      await bob.client.games.join.mutate({ gameId })
      await alice.client.games.startGame.mutate({ gameId })
      const clock = new ControlledClock({ startDate: new Date() })
      const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db: server.database, clock })
      const readViews = async (): Promise<[PlayerView, PlayerView]> =>
        await Promise.all([alice.client.gameplay.getPlayerView.query({ gameId }), bob.client.gameplay.getPlayerView.query({ gameId })])
      const findPlanetOwner = (
        view: PlayerView,
        planetId: PlayerView["galaxy"]["systems"][number]["planets"][number]["id"],
      ): PlayerId | null | undefined =>
        view.galaxy.systems.flatMap(({ planets }) => planets).find(({ id }) => id === planetId)?.ownerPlayerId
      const submitAction = async (
        client: AuthenticatedApiClient["client"],
        view: PlayerView,
        actionDefinitionId: ActionDefinitionId,
        selectedTargets: DeepUnbranded<SubmittedActionTargetsDto["selectedTargets"]>,
        selectedInputs: DeepUnbranded<SubmittedActionTargetsDto["selectedInputs"]>,
      ): Promise<string> => {
        const action = view.actions.find(({ actionDefinitionId: definitionId }) => definitionId === actionDefinitionId)
        Assert.isDefined(action)
        await client.gameplay.updateActionSubmission.mutate({
          gameId,
          turn: view.turn,
          submittedActionTargets: { actionId: action.id, selectedTargets, selectedInputs },
        })
        return action.id
      }

      const createCreateViewsSetupPhase4ResultSetupPhase2Result = await createCreateViewsSetupResultSetup({
        readViews,
        alice,
        bob,
        submitAction,
        buildActionDefinitionId,
        clock,
        turnProcessor,
        turnsRepository,
        gameId,
        builtStrength,
        findPlanetOwner,
        movingStrength,
      })
      const { createViewsSetupPhase4Result, createPriorityTurnSetupPhase5Result } = createCreateViewsSetupPhase4ResultSetupPhase2Result
      let { views } = createCreateViewsSetupPhase4ResultSetupPhase2Result
      const { priorityTurn, rollbackMessage } = createPriorityTurnSetupPhase5Result
      let { observed } = createPriorityTurnSetupPhase5Result
      await expect(
        server.database.transaction(async (tx) => {
          const turn = await turnsRepository.getNextTurnForProcessing({ since: clock.now() }, tx)
          Assert.isDefined(turn)
          expect(turn.gameId).toBe(gameId)
          expect(turn.turn).toBe(priorityTurn)
          observed = structuredClone(await turnsRepository.startTurnProcessing({ turn, processingStartedAt: clock.now() }, tx))
          throw new TransactionRollbackError(rollbackMessage)
        }),
      ).rejects.toMatchObject({ name: "TransactionRollbackError", message: rollbackMessage })
      Assert.isDefined(observed)

      const createCapturedInputSetupPhase6Result = await createCapturedInputSetup({
        ...createViewsSetupPhase4Result,
        ...createPriorityTurnSetupPhase5Result,
        observed,
        builtStrength,
        movingStrength,
        turnProcessor,
      })
      const { capturedInput } = createCapturedInputSetupPhase6Result
      Assert.isDefined(capturedInput)
      views = await readViews()

      const createPersistedAliceSetupPhase7Result = await createPersistedAliceSetup({
        ...createViewsSetupPhase4Result,
        ...createPriorityTurnSetupPhase5Result,
        ...createCapturedInputSetupPhase6Result,
        views,
        findPlanetOwner,
        movingStrength,
        bobHomeRemainderStrengths,
        server,
        gameId,
        capturedInput,
      })
      const { assertPersistedNextRngStatePhase6CapturedInput } = createPersistedAliceSetupPhase7Result

      Assert.isDefined(assertPersistedNextRngStatePhase6CapturedInput)

      verifyPublicState({
        ...createViewsSetupPhase4Result,
        ...createPriorityTurnSetupPhase5Result,
        ...createCapturedInputSetupPhase6Result,
        ...createPersistedAliceSetupPhase7Result,
        assertPersistedNextRngStatePhase6CapturedInput,
        gameId,
        movingStrength,
        findPlanetOwner,
        views,
      })
    },
  )
})

async function assertUntouchedAfterObserved({
  observed,
  savedNextTurn,
  expectedNextRngState,
  forwardReplay,
  alice,
  untouchedGameId,
  untouchedInitialView,
  target,
  gameId,
  homeA,
  homeB,
  distances,
  observationView,
  observedPreResolutionRngState,
  bob,
  firstTieShuffleDraw,
  expectedOwner,
  persistedOwner,
  finalStrengths,
  aliceAfter,
  bobAfter,
}: AssertUntouchedAfterObservedInput): Promise<void> {
  Assert.isDefined(observed)
  const assertUntouchedAfterPhase3Observed = observed

  await assertUntouchedAfter({
    savedNextTurn,
    expectedNextRngState,
    forwardReplay,
    alice,
    untouchedGameId,
    untouchedInitialView,
    target,
    gameId,
    homeA,
    homeB,
    distances,
    observationView,
    observedPreResolutionRngState,
    assertUntouchedAfterPhase3Observed,
    bob,
    firstTieShuffleDraw,
    expectedOwner,
    persistedOwner,
    finalStrengths,
    aliceAfter,
    bobAfter,
  })
}

function verifyPublicState({
  savedNextTurn,
  assertPersistedNextRngStatePhase6CapturedInput,
  replay,
  gameId,
  movingStrength,
  homeA,
  homeB,
  target,
  distances,
  stagedAlice,
  stagedBob,
  aliceColonizeActionId,
  bobColonizeActionId,
  findPlanetOwner,
  views,
  persistedAlice,
  persistedBob,
}: VerifyPublicStateInput): void {
  assertPersistedNextRngState({
    savedNextTurn,
    assertPersistedNextRngStatePhase6CapturedInput,
    replay,
    gameId,
    movingStrength,
    homeA,
    homeB,
    target,
    distances,
    stagedAlice,
    stagedBob,
    aliceColonizeActionId,
    bobColonizeActionId,
    findPlanetOwner,
    views,
    persistedAlice,
    persistedBob,
  })
}

type AssertUntouchedAfterObservedInput = {
  observed: undefined | ReturnType<typeof reverseWorkerInputEnumeration>
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
  expectedNextRngState: { generatorState: number; spareNormal: null | number }
  forwardReplay: ReturnType<typeof replayWorkerInput>
  alice: AuthenticatedApiClient
  untouchedGameId: GameId
  untouchedInitialView: PlayerView
  target: Planet
  gameId: GameId
  homeA: Planet
  homeB: Planet
  distances: number[]
  observationView: PlayerView
  observedPreResolutionRngState: RngState<number>
  bob: AuthenticatedApiClient
  firstTieShuffleDraw: number
  expectedOwner: PlayerId
  persistedOwner: undefined | null | PlayerId
  finalStrengths: Array<{ playerId: PlayerId; strength: number }>
  aliceAfter: PlayerView
  bobAfter: PlayerView
}

type VerifyPublicStateInput = {
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
  assertPersistedNextRngStatePhase6CapturedInput: ReturnType<typeof reverseWorkerInputEnumeration>
  replay: ReturnType<typeof replayWorkerInput>
  gameId: GameId
  movingStrength: 35 | 70
  homeA: Planet
  homeB: Planet
  target: Planet
  distances: number[]
  stagedAlice: Fleet
  stagedBob: Fleet
  aliceColonizeActionId: string
  bobColonizeActionId: string
  findPlanetOwner: (view: PlayerView, planetId: PlanetId) => undefined | null | PlayerId
  views: [PlayerView, PlayerView]
  persistedAlice: Fleet
  persistedBob: Fleet
}

async function createCreateObservedPreResolutionRngStateSetupResultSetup({
  createClockSetupPhase1Result,
  createHomeASetupPhase2Result,
  observed,
  colonizeActionIds,
  stationedFleets,
}: CreateCreateObservedPreResolutionRngStateSetupResultSetupInput): Promise<CreateCreateObservedPreResolutionRngStateSetupResultSetupResult> {
  Assert.isDefined(observed)
  const createObservedPreResolutionRngStateSetupPhase3Result = await createObservedPreResolutionRngStateSetup({
    ...createClockSetupPhase1Result,
    ...createHomeASetupPhase2Result,
    observed,
    colonizeActionIds,
    stationedFleets,
  })
  const { expectedOwner, aliceAfter, bobAfter, alicePlayerId, bobPlayerId, aliceSurvivor, bobSurvivor } =
    createObservedPreResolutionRngStateSetupPhase3Result
  const finalStrengths = [
    { playerId: alicePlayerId, strength: aliceSurvivor.strength },
    { playerId: bobPlayerId, strength: bobSurvivor.strength },
  ]
  expect(finalStrengths).toHaveLength(2)
  expect(aliceSurvivor.strength).toBe(tieWinnerForce(alicePlayerId, expectedOwner))
  expect(bobSurvivor.strength).toBe(tieWinnerForce(bobPlayerId, expectedOwner))
  return { createObservedPreResolutionRngStateSetupPhase3Result, aliceAfter, bobAfter, finalStrengths }
}

async function createCreateViewsSetupResultSetup({
  readViews,
  alice,
  bob,
  submitAction,
  buildActionDefinitionId,
  clock,
  turnProcessor,
  turnsRepository,
  gameId,
  builtStrength,
  findPlanetOwner,
  movingStrength,
}: CreateCreateViewsSetupResultSetupInput): Promise<CreateCreateViewsSetupResultSetupResult> {
  const createViewsSetupPhase4Result = await createViewsSetup({
    readViews,
    alice,
    bob,
    submitAction,
    buildActionDefinitionId,
    clock,
    turnProcessor,
    turnsRepository,
    gameId,
    builtStrength,
    findPlanetOwner,
  })

  const { views } = createViewsSetupPhase4Result

  const createPriorityTurnSetupPhase5Result = await createPriorityTurnSetup({
    ...createViewsSetupPhase4Result,
    builtStrength,
    findPlanetOwner,
    submitAction,
    alice,
    bob,
    movingStrength,
    readViews,
    clock,
    turnsRepository,
    gameId,
  })
  return { createViewsSetupPhase4Result, views, createPriorityTurnSetupPhase5Result }
}

type CreateCreateObservedPreResolutionRngStateSetupResultSetupInput = {
  createClockSetupPhase1Result: Awaited<ReturnType<typeof CapturedcreateClockSetup>>
  createHomeASetupPhase2Result: Awaited<ReturnType<typeof CapturedcreateHomeASetup>>
  observed: undefined | ReturnType<typeof reverseWorkerInputEnumeration>
  colonizeActionIds: string[]
  stationedFleets: Array<undefined | Fleet>
}

type CreateCreateObservedPreResolutionRngStateSetupResultSetupResult = {
  createObservedPreResolutionRngStateSetupPhase3Result: Awaited<ReturnType<typeof CapturedcreateObservedPreResolutionRngStateSetup>>
  aliceAfter: PlayerView
  bobAfter: PlayerView
  finalStrengths: Array<{ playerId: PlayerId; strength: number }>
}

type CreateCreateViewsSetupResultSetupInput = {
  readViews: () => Promise<[PlayerView, PlayerView]>
  alice: AuthenticatedApiClient
  bob: AuthenticatedApiClient
  submitAction: SubmitActionCallback
  buildActionDefinitionId: ActionDefinitionId
  clock: ControlledClock
  turnProcessor: TurnProcessor
  turnsRepository: TurnsRepository
  gameId: GameId
  builtStrength: 40 | 70
  findPlanetOwner: (view: PlayerView, planetId: PlanetId) => undefined | null | PlayerId
  movingStrength: 35 | 70
}

type CreateCreateViewsSetupResultSetupResult = {
  createViewsSetupPhase4Result: Awaited<ReturnType<typeof CapturedcreateViewsSetup>>
  views: [PlayerView, PlayerView]
  createPriorityTurnSetupPhase5Result: Awaited<ReturnType<typeof CapturedcreatePriorityTurnSetup>>
}

type SubmitActionCallback = (
  client: AuthenticatedApiClient["client"],
  view: PlayerView,
  actionDefinitionId: ActionDefinitionId,
  selectedTargets: DeepUnbranded<SelectedTargets>,
  selectedInputs: DeepUnbranded<SelectedInputs>,
) => Promise<string>
