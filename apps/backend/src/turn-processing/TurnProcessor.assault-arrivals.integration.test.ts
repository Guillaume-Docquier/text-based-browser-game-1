import { Assert, branded, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { createGameConfigurationStub } from "shared/domain/games/GameConfiguration.stub.ts"
import type { GameId } from "shared/domain/games/GameId.ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import { required } from "shared/testing/required.ts"
import { AttackMoveTest, FlexibleAssaultTest } from "shared/testing/test-ruleset/action-definitions/attack-move.ts"
import { BuildFleetStandard } from "shared/testing/test-ruleset/action-definitions/build-fleet.ts"
import { MoveFleetImproved, MoveFleetStandard } from "shared/testing/test-ruleset/action-definitions/move-fleet.ts"
import { afterEach, describe, expect, vi } from "vitest"
import { createApiStub } from "#api/createApi.stub.ts"
import type { Fleet, Planet, Action, PlayerView } from "#api/types.ts"
import { ControlledClock } from "#lib/ControlledClock.ts"
import type { AuthenticatedApiClient } from "#tests/ApiClient.ts"
import { ApiServer } from "#tests/ApiServer.ts"
import { integrationTest } from "#tests/vitest.integration.fixture.ts"
import { createTurnProcessorStub } from "#turn-processing/TurnProcessor.stub.ts"
import type { TurnProcessor } from "#turn-processing/TurnProcessor.ts"
import { processPublicTurn, getActionToSubmintegrationTest, FailingTurnsRepository } from "../tests/fleet-worker/TurnProcessor.scenarios.ts"
import { SpeedTwoAssaultWorkerTest, AssaultWorkerRuleset, WorkerI207Ruleset } from "../tests/fleet-worker/TurnProcessor.ts"

describe("TurnProcessor", () => {
  integrationTest(
    "should treat a full outgoing fleet as absent when the real worker resolves a later enemy arrival",
    { timeout: 60_000 },
    async ({ db }) => {
      // Arrange: create the stable public two-player map and build A30/B20 through public actions and worker turns.
      const clock = new ControlledClock()
      const apiServices = await createApiStub({ db, clock })
      Assert.isSuccess(await apiServices.rulesetsRepository.upsertRuleset(WorkerI207Ruleset))
      using apiServer = new ApiServer(apiServices)
      const alice = await apiServer.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000001" })
      const bob = await apiServer.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000002" })
      const clients = [alice, bob]
      const playerIds = [branded<PlayerId>(alice.account.id), branded<PlayerId>(bob.account.id)]
      const { createdGameId: gameId } = await alice.client.games.create.mutate({
        configuration: createGameConfigurationStub({
          rulesetId: WorkerI207Ruleset.id,
          nbSeats: 2,
          turnIntervalSeconds: Time.in(Time.create(10, UnitOfTime.SECONDS), UnitOfTime.SECONDS),
          mapGenerationSeed: 147,
        }),
      })
      await bob.client.games.join.mutate({ gameId })
      await alice.client.games.startGame.mutate({ gameId })
      const { turnProcessor } = await createTurnProcessorStub({ db, clock })
      const initialView = await alice.client.gameplay.getPlayerView.query({ gameId })
      const planets = initialView.galaxy.systems.flatMap(({ planets: systemPlanets }) => systemPlanets)
      const target = planets.find(({ coordinates }) => coordinates === "45:83:40")
      const bobHome = planets.find(({ ownerPlayerId }) => ownerPlayerId === playerIds[1])
      Assert.isDefined(target)
      Assert.isDefined(bobHome)

      await verifyBuildRound({ clients, gameId, target, bobHome, turnProcessor })
      const builtView = await alice.client.gameplay.getPlayerView.query({ gameId })
      const defender = builtView.fleets.find(
        ({ ownerPlayerId, originPlanetId, movement }) =>
          ownerPlayerId === playerIds[0] && originPlanetId === target.id && movement === undefined,
      )
      const enemy = builtView.fleets.find(
        ({ ownerPlayerId, originPlanetId, movement }) =>
          ownerPlayerId === playerIds[1] && originPlanetId === bobHome.id && movement === undefined,
      )
      Assert.isDefined(defender)
      Assert.isDefined(enemy)

      await verifyDefender({ defender, enemy, bob, gameId, builtView, target, clients, turnProcessor, alice })

      await verifyCreateNearEnemySetupResult({ alice, gameId, playerIds, defender, bobHome, clients, turnProcessor, target })
    },
  )

  integrationTest("should persist composed Assault intent through public turns and resolve it once after reload", async ({ db }) => {
    // Arrange: create the genuine public game, build its fleets, and establish the immutable seed-147 map fixture.
    const clock = new ControlledClock()
    const apiServices = await createApiStub({ db, clock })
    Assert.isSuccess(await apiServices.rulesetsRepository.upsertRuleset(AssaultWorkerRuleset))
    using apiServer = new ApiServer(apiServices)
    const alice = await apiServer.createClient({ authenticated: true })
    const bob = await apiServer.createClient({ authenticated: true })
    const turnInterval = Time.create(10, UnitOfTime.SECONDS)
    const { createdGameId: gameId } = await alice.client.games.create.mutate({
      configuration: createGameConfigurationStub({
        rulesetId: AssaultWorkerRuleset.id,
        nbSeats: 2,
        turnIntervalSeconds: Time.in(turnInterval, UnitOfTime.SECONDS),
        mapGenerationSeed: 147,
      }),
    })
    await bob.client.games.join.mutate({ gameId })
    await alice.client.games.startGame.mutate({ gameId })

    const alicePlayerId = branded<PlayerId>(alice.account.id)
    const bobPlayerId = branded<PlayerId>(bob.account.id)
    const { turnProcessor } = await createTurnProcessorStub({ db, clock })
    const initialView = await alice.client.gameplay.getPlayerView.query({ gameId })
    const planets = initialView.galaxy.systems.flatMap(({ planets: systemPlanets }) => systemPlanets)
    const aliceHome = planets.find(({ ownerPlayerId }) => ownerPlayerId === alicePlayerId)
    const bobHome = planets.find(({ ownerPlayerId }) => ownerPlayerId === bobPlayerId)
    Assert.isDefined(aliceHome)
    Assert.isDefined(bobHome)
    expect([aliceHome.coordinates, bobHome.coordinates].toSorted()).toStrictEqual(["44:98:05", "45:83:40"])
    expect(Math.hypot(bobHome.x - aliceHome.x, bobHome.y - aliceHome.y)).toBe(4.418312565270031)

    const processReadyTurn = async (turn: number): Promise<void> => {
      await alice.client.gameplay.updateReadiness.mutate({ gameId, turn, isReady: true })
      await bob.client.gameplay.updateReadiness.mutate({ gameId, turn, isReady: true })
      expect(await turnProcessor.processNextDueTurn()).toBe("processed")
    }

    await verifyBuildTurn({ alice, gameId, aliceHome, bob, bobHome, processReadyTurn })

    await verifyCreateAliceSourceSetupResult({ alice, gameId, alicePlayerId, aliceHome, bobPlayerId, bobHome, processReadyTurn })
  })

  integrationTest.for([false, true])(
    "should save an exact speed-two 5I/1F Assault across public worker reloads (friendly guard: %s)",
    async (moveFriendlyGuard, { db }) => {
      // Arrange: create the authenticated public clients and helpers for supported game setup and worker turns.
      const clock = new ControlledClock()
      const apiServices = await createApiStub({ db, clock })
      Assert.isSuccess(await apiServices.rulesetsRepository.upsertRuleset(AssaultWorkerRuleset))
      using apiServer = new ApiServer(apiServices)
      const alice = await apiServer.createClient({ authenticated: true })
      const bob = await apiServer.createClient({ authenticated: true })
      const turnInterval = Time.create(10, UnitOfTime.SECONDS)
      const { turnProcessor } = await createTurnProcessorStub({ db, clock })
      const processReadyTurn = async (gameId: number, turn: number): Promise<void> => {
        await alice.client.gameplay.updateReadiness.mutate({ gameId, turn, isReady: true })
        await bob.client.gameplay.updateReadiness.mutate({ gameId, turn, isReady: true })
        expect(await turnProcessor.processNextDueTurn()).toBe("processed")
      }
      const createBuiltGame = async (): Promise<{
        gameId: number
        aliceHome: PlayerView["galaxy"]["systems"][number]["planets"][number]
        bobHome: PlayerView["galaxy"]["systems"][number]["planets"][number]
        source: PlayerView["fleets"][number]
        defender: PlayerView["fleets"][number]
      }> => {
        const { createdGameId: gameId } = await alice.client.games.create.mutate({
          configuration: createGameConfigurationStub({
            rulesetId: AssaultWorkerRuleset.id,
            nbSeats: 2,
            turnIntervalSeconds: Time.in(turnInterval, UnitOfTime.SECONDS),
            mapGenerationSeed: 147,
          }),
        })
        await bob.client.games.join.mutate({ gameId })
        await alice.client.games.startGame.mutate({ gameId })
        const initialView = await alice.client.gameplay.getPlayerView.query({ gameId })
        const planets = initialView.galaxy.systems.flatMap(({ planets }) => planets)
        const aliceHome = planets.find(({ ownerPlayerId }) => ownerPlayerId === initialView.player.id)
        const bobView = await bob.client.gameplay.getPlayerView.query({ gameId })
        const bobHome = bobView.galaxy.systems
          .flatMap(({ planets }) => planets)
          .find(({ ownerPlayerId }) => ownerPlayerId === bobView.player.id)
        Assert.isDefined(aliceHome)
        Assert.isDefined(bobHome)
        expect([aliceHome.coordinates, bobHome.coordinates].toSorted()).toStrictEqual(["44:98:05", "45:83:40"])
        expect(Math.hypot(bobHome.x - aliceHome.x, bobHome.y - aliceHome.y)).toBe(4.418312565270031)

        for (let buildTurn = 1; buildTurn <= 5; buildTurn += 1) {
          const aliceView = await alice.client.gameplay.getPlayerView.query({ gameId })
          await alice.client.gameplay.updateActionSubmission.mutate({
            gameId,
            turn: aliceView.turn,
            submittedActionTargets: getActionToSubmintegrationTest(aliceView, BuildFleetStandard.id, { planet: aliceHome.id }),
          })
          if (buildTurn <= 2) {
            const currentBobView = await bob.client.gameplay.getPlayerView.query({ gameId })
            await bob.client.gameplay.updateActionSubmission.mutate({
              gameId,
              turn: currentBobView.turn,
              submittedActionTargets: getActionToSubmintegrationTest(currentBobView, BuildFleetStandard.id, { planet: bobHome.id }),
            })
          }
          await processReadyTurn(gameId, aliceView.turn)
        }

        const readyView = await alice.client.gameplay.getPlayerView.query({ gameId })
        const source = readyView.fleets.find(
          ({ ownerPlayerId, originPlanetId, movement }) =>
            ownerPlayerId === readyView.player.id && originPlanetId === aliceHome.id && movement === undefined,
        )
        const defender = readyView.fleets.find(
          ({ ownerPlayerId, originPlanetId, movement }) =>
            ownerPlayerId !== readyView.player.id && originPlanetId === bobHome.id && movement === undefined,
        )
        Assert.isDefined(source)
        Assert.isDefined(defender)
        expect(source.strength).toBe(50)
        expect(defender.strength).toBe(20)
        return { gameId, aliceHome, bobHome, source, defender }
      }

      const runCombat = async (fixture: Awaited<ReturnType<typeof createBuiltGame>>, moveFriendlyGuard: boolean): Promise<void> => {
        let friendlyGuard: typeof fixture.source | undefined
        if (moveFriendlyGuard) {
          // Act: move the friendly force through submitted actions and real worker turns before the Assault.
          const beforeMove = await alice.client.gameplay.getPlayerView.query({ gameId: fixture.gameId })
          await alice.client.gameplay.updateActionSubmission.mutate({
            gameId: fixture.gameId,
            turn: beforeMove.turn,
            submittedActionTargets: getActionToSubmintegrationTest(
              beforeMove,
              MoveFleetImproved.id,
              { fleet: fixture.source.id, planet: fixture.bobHome.id },
              { strength: 7 },
            ),
          })
          await processReadyTurn(fixture.gameId, beforeMove.turn)
          let movingView = await alice.client.gameplay.getPlayerView.query({ gameId: fixture.gameId })
          const moveAction = movingView.actions.find(({ actionDefinitionId }) => actionDefinitionId === MoveFleetImproved.id)
          Assert.isDefined(moveAction)
          const movingGuard = movingView.fleets.find(({ movement }) => movement?.submission.id === moveAction.id)
          Assert.isDefined(movingGuard)
          Assert.isDefined(movingGuard.movement)
          expect(movingGuard).toMatchObject({ strength: 7, distanceToEnd: 3.418312565270031 })
          for (let moveTurn = 0; moveTurn < 4; moveTurn += 1) {
            await processReadyTurn(fixture.gameId, movingView.turn)
            movingView = await alice.client.gameplay.getPlayerView.query({ gameId: fixture.gameId })
            expect(required(movingView.fleets.find(({ id }) => id === fixture.defender.id)).strength).toBe(20)
            if (moveTurn < 3) {
              const continuedGuard: PlayerView["fleets"][number] | undefined = movingView.fleets.find(({ id }) => id === movingGuard.id)
              Assert.isDefined(continuedGuard)
              const expectedRemainder = [2.418312565270031, 1.418312565270031, 0.418312565270031][moveTurn]
              expect(continuedGuard.distanceToEnd).toBe(expectedRemainder)
            }
          }
          friendlyGuard = movingView.fleets.find(
            ({ ownerPlayerId, originPlanetId, movement }) =>
              ownerPlayerId === movingView.player.id && originPlanetId === fixture.bobHome.id && movement === undefined,
          )
          Assert.isDefined(friendlyGuard)
          expect(friendlyGuard).toMatchObject({ strength: 7, name: movingGuard.name, id: movingGuard.id })
          expect(required(movingView.fleets.find(({ id }) => id === fixture.defender.id)).strength).toBe(20)
        }

        const attackActionSetup1 = await createAttackActionSetup({ alice, fixture, moveFriendlyGuard, processReadyTurn })

        await verifyJourney({ ...attackActionSetup1, fixture, processReadyTurn, alice })
        // Assert: arrival combat preserves the correct owner, survivor identity, resources, and next-turn release.

        await verifyArrivalView({ ...attackActionSetup1, alice, fixture, friendlyGuard, processReadyTurn })
      }

      await runCombat(await createBuiltGame(), moveFriendlyGuard)
    },
  )

  describe("processTurnsForever", () => {
    afterEach(() => {
      vi.clearAllTimers()
      vi.useRealTimers()
    })

    integrationTest("should process all currently due turns before waiting", async ({ db }) => {
      // Arrange
      const clock = new ControlledClock()
      using apiServer = new ApiServer(await createApiStub({ db, clock }))
      const player = await apiServer.createClient({ authenticated: true })

      const turnInterval = Time.create(100, UnitOfTime.SECONDS)
      const { createdGameId: firstGameId } = await player.client.games.create.mutate({
        configuration: createGameConfigurationStub({ turnIntervalSeconds: Time.in(turnInterval, UnitOfTime.SECONDS) / 2 }),
      })
      await player.client.games.startGame.mutate({ gameId: firstGameId })

      const { createdGameId: secondGameId } = await player.client.games.create.mutate({
        configuration: createGameConfigurationStub({ turnIntervalSeconds: Time.in(turnInterval, UnitOfTime.SECONDS) }),
      })
      await player.client.games.startGame.mutate({ gameId: secondGameId })

      const { turnProcessor } = await createTurnProcessorStub({ db, clock })

      // Act
      vi.useFakeTimers()
      clock.increment({ time: turnInterval })
      await turnProcessor.processTurnsForever({ interval: Time.create(1, UnitOfTime.SECONDS) })

      // Assert
      expect(vi.getTimerCount()).toBe(1)
      vi.clearAllTimers()
      vi.useRealTimers()

      expect(await player.client.gameplay.getPlayerView.query({ gameId: firstGameId })).toMatchObject({
        turn: 2,
        resources: { [ResourceType.INFLUENCE]: { total: 3, uncommitted: 3 } },
      })

      expect(await player.client.gameplay.getPlayerView.query({ gameId: secondGameId })).toMatchObject({
        turn: 2,
        resources: { [ResourceType.INFLUENCE]: { total: 3, uncommitted: 3 } },
      })
    })

    integrationTest("should wait before retrying when the selected turn processing fails", async ({ db }) => {
      // Arrange
      const clock = new ControlledClock()
      const { api, accountsRepository, logger } = await createApiStub({ db, clock })
      using apiServer = new ApiServer({ api, accountsRepository })
      const player = await apiServer.createClient({ authenticated: true })

      const turnInterval = Time.create(100, UnitOfTime.SECONDS)
      const { createdGameId: failingGameId } = await player.client.games.create.mutate({
        configuration: createGameConfigurationStub({ turnIntervalSeconds: Time.in(turnInterval, UnitOfTime.SECONDS) }),
      })
      await player.client.games.startGame.mutate({ gameId: failingGameId })

      const { createdGameId: successfulGameId } = await player.client.games.create.mutate({
        configuration: createGameConfigurationStub({ turnIntervalSeconds: Time.in(turnInterval, UnitOfTime.SECONDS) }),
      })
      await player.client.games.startGame.mutate({ gameId: successfulGameId })

      const turnsRepository = new FailingTurnsRepository({ db, logger, failingGameId })
      const { turnProcessor } = await createTurnProcessorStub({ db, clock, turnsRepository })

      // Act
      vi.useFakeTimers()
      clock.increment({ time: turnInterval })
      await turnProcessor.processTurnsForever({ interval: Time.create(1, UnitOfTime.SECONDS) })

      // Assert
      expect(vi.getTimerCount()).toBe(1)
      vi.clearAllTimers()
      vi.useRealTimers()

      // No turns were processed because turns in error block, this will be resolved by https://github.com/Guillaume-Docquier/text-based-browser-game-1/issues/278
      expect(await player.client.gameplay.getPlayerView.query({ gameId: failingGameId })).toMatchObject({
        turn: 1,
        resources: { [ResourceType.INFLUENCE]: { total: 3, uncommitted: 3 } },
      })

      expect(await player.client.gameplay.getPlayerView.query({ gameId: successfulGameId })).toMatchObject({
        turn: 1,
        resources: { [ResourceType.INFLUENCE]: { total: 3, uncommitted: 3 } },
      })
    })
  })
})

function assertFirstJourney(input: AssertFirstJourneyInput): void {
  expect(input.firstJourney).toMatchObject({ strength: 30, distanceToEnd: 2.418312565270031, destinationPlanetId: input.bobHome.id })
  expect(input.firstJourney.movement).toMatchObject({
    speed: 2,
    departureTurn: input.readyForAttack.turn,
    submission: {
      id: input.assaultAction.id,
      playerId: input.alicePlayerId,
      actionDefinitionId: FlexibleAssaultTest.id,
      selectedTargets: { source: input.aliceSource.id, destination: input.bobHome.id },
      selectedInputs: { force: 30 },
    },
    pendingArrivalEffects: [{ definitionOrdinal: 3, effectDefinition: { type: "FLEET_ASSAULT" } }],
  })
  expect(input.firstRemainder).toMatchObject({ strength: 20, originPlanetId: input.aliceHome.id })
  expect(required(input.firstSavedView.actions.find(({ id }) => id === input.assaultAction.id)).isInProgress).toBe(true)
  expect(required(input.firstSavedView.fleets.find(({ id }) => id === input.bobDefender.id)).strength).toBe(20)
}

type AssertFirstJourneyInput = {
  firstJourney: Fleet
  bobHome: Planet
  readyForAttack: PlayerView
  assaultAction: Action
  alicePlayerId: PlayerId
  aliceSource: Fleet
  firstRemainder: Fleet
  aliceHome: Planet
  firstSavedView: PlayerView
  bobDefender: Fleet
}

async function createNearEnemySetup(input: CreateNearEnemySetupInput): Promise<CreateNearEnemySetupResult> {
  const arrivalView = await input.alice.client.gameplay.getPlayerView.query({ gameId: input.gameId })
  const nearEnemy = arrivalView.fleets.find(({ ownerPlayerId, movement }) => ownerPlayerId === input.playerIds[1] && movement !== undefined)
  Assert.isDefined(nearEnemy)
  expect(nearEnemy.distanceToEnd).toBe(0.418312565270031)
  expect(required(arrivalView.fleets.find(({ id }) => id === input.defender.id)).strength).toBe(30)

  // Act: move all thirty defender Strength away through a public ordinary Move while the enemy Assault arrives.
  await input.alice.client.gameplay.updateActionSubmission.mutate({
    gameId: input.gameId,
    turn: arrivalView.turn,
    submittedActionTargets: getActionToSubmintegrationTest(
      arrivalView,
      MoveFleetStandard.id,
      { fleet: input.defender.id, planet: input.bobHome.id },
      { strength: 30 },
    ),
  })
  await processPublicTurn({ ...input, turn: arrivalView.turn })

  // Assert: the transit-origin fleet does not defend the target; the Assault resolves as an empty-target no-op.
  const afterCombat = await input.alice.client.gameplay.getPlayerView.query({ gameId: input.gameId })
  const outbound = afterCombat.fleets.find(({ ownerPlayerId, movement }) => ownerPlayerId === input.playerIds[0] && movement !== undefined)
  const arrivedEnemy = afterCombat.fleets.find(
    ({ ownerPlayerId, originPlanetId, movement }) =>
      ownerPlayerId === input.playerIds[1] && originPlanetId === input.target.id && movement === undefined,
  )
  Assert.isDefined(outbound)
  Assert.isDefined(arrivedEnemy)
  expect(outbound).toMatchObject({
    strength: 30,
    originPlanetId: input.target.id,
    destinationPlanetId: input.bobHome.id,
    movement: { speed: 0.1 },
    distanceToEnd: 4.318312565270031,
  })
  expect(afterCombat.fleets.find(({ id }) => id === input.defender.id)).toBeUndefined()
  expect(arrivedEnemy.strength).toBe(20)
  return { nearEnemy, afterCombat }
}

async function createAliceSourceSetup(input: CreateAliceSourceSetupInput): Promise<CreateAliceSourceSetupResult> {
  const readyForAttack = await input.alice.client.gameplay.getPlayerView.query({ gameId: input.gameId })
  const aliceSource = readyForAttack.fleets.find(
    ({ ownerPlayerId, originPlanetId, movement }) =>
      ownerPlayerId === input.alicePlayerId && originPlanetId === input.aliceHome.id && movement === undefined,
  )
  const bobDefender = readyForAttack.fleets.find(
    ({ ownerPlayerId, originPlanetId, movement }) =>
      ownerPlayerId === input.bobPlayerId && originPlanetId === input.bobHome.id && movement === undefined,
  )
  Assert.isDefined(aliceSource)
  Assert.isDefined(bobDefender)
  expect(aliceSource.strength).toBe(50)
  expect(bobDefender.strength).toBe(20)
  const assaultAction = readyForAttack.actions.find(({ actionDefinitionId }) => actionDefinitionId === FlexibleAssaultTest.id)
  Assert.isDefined(assaultAction)

  // Act: submit the composed departure through the public API and advance it through the production worker.
  await input.alice.client.gameplay.updateActionSubmission.mutate({
    gameId: input.gameId,
    turn: readyForAttack.turn,
    submittedActionTargets: getActionToSubmintegrationTest(
      readyForAttack,
      FlexibleAssaultTest.id,
      { source: aliceSource.id, destination: input.bobHome.id },
      { force: 30 },
    ),
  })
  const selectedView = await input.alice.client.gameplay.getPlayerView.query({ gameId: input.gameId })
  expect(selectedView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 90, uncommitted: 83 })
  expect(selectedView.resources[ResourceType.FUEL]).toStrictEqual({ total: 100, uncommitted: 98 })
  expect(required(selectedView.fleets.find(({ id }) => id === aliceSource.id)).strength).toBe(50)

  // Assert: the public readiness API closes the turn; the real resolver saves through the worker repository.
  await input.processReadyTurn(readyForAttack.turn)
  const firstSavedView = await input.alice.client.gameplay.getPlayerView.query({ gameId: input.gameId })
  const firstJourney = firstSavedView.fleets.find(({ movement }) => movement?.submission.id === assaultAction.id)
  const firstRemainder = firstSavedView.fleets.find(({ id }) => id === aliceSource.id)
  Assert.isDefined(firstJourney)
  Assert.isDefined(firstJourney.movement)
  Assert.isDefined(firstRemainder)

  assertFirstJourney({ ...input, firstJourney, readyForAttack, assaultAction, aliceSource, firstRemainder, firstSavedView, bobDefender })
  return { aliceSource, bobDefender, assaultAction, firstSavedView, firstJourney }
}

async function createAfterEmptyTurnSetup(input: CreateAfterEmptyTurnSetupInput): Promise<CreateAfterEmptyTurnSetupResult> {
  await input.processReadyTurn(input.firstSavedView.turn)
  const secondSavedView = await input.alice.client.gameplay.getPlayerView.query({ gameId: input.gameId })
  const secondJourney = secondSavedView.fleets.find(({ id }) => id === input.firstJourney.id)
  Assert.isDefined(secondJourney)
  expect(secondJourney.distanceToEnd).toBe(0.418312565270031)
  expect(required(secondSavedView.fleets.find(({ id }) => id === input.bobDefender.id)).strength).toBe(20)
  expect(secondSavedView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 83, uncommitted: 83 })
  expect(secondSavedView.resources[ResourceType.FUEL]).toStrictEqual({ total: 98, uncommitted: 98 })

  await input.processReadyTurn(secondSavedView.turn)
  const arrivalView = await input.alice.client.gameplay.getPlayerView.query({ gameId: input.gameId })
  const arrivedFleet = arrivalView.fleets.find(({ id }) => id === input.firstJourney.id)
  Assert.isDefined(arrivedFleet)
  expect(arrivedFleet).toStrictEqual({
    id: input.firstJourney.id,
    name: input.firstJourney.name,
    ownerPlayerId: input.alicePlayerId,
    strength: 10,
    originPlanetId: input.bobHome.id,
  })
  expect(arrivalView.fleets.find(({ id }) => id === input.bobDefender.id)).toBeUndefined()
  expect(arrivalView.fleets.find(({ id }) => id === input.aliceSource.id)).toMatchObject({
    strength: 20,
    originPlanetId: input.aliceHome.id,
  })
  expect(required(arrivalView.actions.find(({ id }) => id === input.assaultAction.id)).isInProgress).toBe(false)
  expect(arrivalView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 83, uncommitted: 83 })
  expect(arrivalView.resources[ResourceType.FUEL]).toStrictEqual({ total: 98, uncommitted: 98 })

  await input.processReadyTurn(arrivalView.turn)
  const afterEmptyTurn = await input.alice.client.gameplay.getPlayerView.query({ gameId: input.gameId })
  expect(required(afterEmptyTurn.fleets.find(({ id }) => id === input.firstJourney.id)).strength).toBe(10)
  return { afterEmptyTurn }
}

type CreateNearEnemySetupInput = {
  alice: AuthenticatedApiClient
  gameId: GameId
  playerIds: PlayerId[]
  defender: Fleet
  bobHome: Planet
  clients: AuthenticatedApiClient[]
  turnProcessor: TurnProcessor
  target: Planet
}

type CreateNearEnemySetupResult = { nearEnemy: Fleet; afterCombat: PlayerView }

type CreateAliceSourceSetupInput = {
  alice: AuthenticatedApiClient
  gameId: GameId
  alicePlayerId: PlayerId
  aliceHome: Planet
  bobPlayerId: PlayerId
  bobHome: Planet
  processReadyTurn: (turn: number) => Promise<void>
}

type CreateAliceSourceSetupResult = {
  aliceSource: Fleet
  bobDefender: Fleet
  assaultAction: Action
  firstSavedView: PlayerView
  firstJourney: Fleet
}

type CreateAfterEmptyTurnSetupInput = {
  processReadyTurn: (turn: number) => Promise<void>
  firstSavedView: PlayerView
  alice: AuthenticatedApiClient
  gameId: GameId
  firstJourney: Fleet
  bobDefender: Fleet
  alicePlayerId: PlayerId
  bobHome: Planet
  aliceSource: Fleet
  aliceHome: Planet
  assaultAction: Action
}

type CreateAfterEmptyTurnSetupResult = { afterEmptyTurn: PlayerView }

async function verifyBuildRound(input: VerifyBuildRoundInput): Promise<void> {
  for (let buildRound = 0; buildRound < 3; buildRound += 1) {
    const views = await Promise.all(
      input.clients.map(async ({ client }) => await client.gameplay.getPlayerView.query({ gameId: input.gameId })),
    )
    for (const [ownerIndex, client] of input.clients.entries()) {
      const view = views[ownerIndex]
      const home = ownerIndex === 0 ? input.target : input.bobHome
      Assert.isDefined(view)
      const buildRounds = [3, 2][ownerIndex] ?? 0
      if (buildRound < buildRounds) {
        await client.client.gameplay.updateActionSubmission.mutate({
          gameId: input.gameId,
          turn: view.turn,
          submittedActionTargets: getActionToSubmintegrationTest(view, BuildFleetStandard.id, { planet: home.id }),
        })
      }
    }
    const view = views[0]
    Assert.isDefined(view)
    await processPublicTurn({ ...input, turn: view.turn })
  }
}

async function verifyDefender(input: VerifyDefenderInput): Promise<void> {
  expect(input.defender.strength).toBe(30)
  expect(input.enemy.strength).toBe(20)

  // Act: start a public enemy Attack Move and let its persisted movement advance to its literal final remainder.
  await input.bob.client.gameplay.updateActionSubmission.mutate({
    gameId: input.gameId,
    turn: input.builtView.turn,
    submittedActionTargets: getActionToSubmintegrationTest(
      await input.bob.client.gameplay.getPlayerView.query({ gameId: input.gameId }),
      AttackMoveTest.id,
      { fleet: input.enemy.id, planet: input.target.id },
      { strength: 20 },
    ),
  })
  await processPublicTurn({ ...input, turn: input.builtView.turn })
  for (let advance = 0; advance < 3; advance += 1) {
    const view = await input.alice.client.gameplay.getPlayerView.query({ gameId: input.gameId })
    await processPublicTurn({ ...input, turn: view.turn })
  }
}

async function verifyCreateNearEnemySetupResult(input: VerifyCreateNearEnemySetupResultInput): Promise<void> {
  const nearEnemySetup1 = await createNearEnemySetup({ ...input })
  const { nearEnemy, afterCombat } = nearEnemySetup1
  expect(afterCombat.actions.find(({ id }) => id === nearEnemy.movement?.submission.id)).toMatchObject({
    selectedTargets: null,
    isInProgress: false,
  })
}

async function verifyBuildTurn(input: VerifyBuildTurnInput): Promise<void> {
  for (let buildTurn = 1; buildTurn <= 5; buildTurn += 1) {
    const aliceView = await input.alice.client.gameplay.getPlayerView.query({ gameId: input.gameId })
    await input.alice.client.gameplay.updateActionSubmission.mutate({
      gameId: input.gameId,
      turn: aliceView.turn,
      submittedActionTargets: getActionToSubmintegrationTest(aliceView, BuildFleetStandard.id, { planet: input.aliceHome.id }),
    })
    if (buildTurn <= 2) {
      const bobView = await input.bob.client.gameplay.getPlayerView.query({ gameId: input.gameId })
      await input.bob.client.gameplay.updateActionSubmission.mutate({
        gameId: input.gameId,
        turn: bobView.turn,
        submittedActionTargets: getActionToSubmintegrationTest(bobView, BuildFleetStandard.id, { planet: input.bobHome.id }),
      })
    }
    await input.processReadyTurn(aliceView.turn)
  }
}

async function verifyCreateAliceSourceSetupResult(input: VerifyCreateAliceSourceSetupResultInput): Promise<void> {
  const aliceSourceSetup2 = await createAliceSourceSetup({ ...input })
  const { assaultAction } = aliceSourceSetup2

  const afterEmptyTurnSetup3 = await createAfterEmptyTurnSetup({ ...input, ...aliceSourceSetup2 })
  const { afterEmptyTurn } = afterEmptyTurnSetup3
  expect(afterEmptyTurn.actions.find(({ id }) => id === assaultAction.id)).toMatchObject({ selectedTargets: null, isInProgress: false })
}

async function verifyJourney(input: VerifyJourneyInput): Promise<void> {
  expect(input.journey).toMatchObject({ strength: 30, distanceToEnd: 2.418312565270031, destinationPlanetId: input.fixture.bobHome.id })
  expect(required(input.firstReload.fleets.find(({ id }) => id === input.fixture.defender.id)).strength).toBe(20)
  expect(input.firstReload.resources[ResourceType.INFLUENCE]).toStrictEqual({
    total: input.expectedInfluenceUncommitted,
    uncommitted: input.expectedInfluenceUncommitted,
  })
  expect(input.firstReload.resources[ResourceType.FUEL]).toStrictEqual({
    total: input.expectedFuelUncommitted,
    uncommitted: input.expectedFuelUncommitted,
  })

  await input.processReadyTurn(input.fixture.gameId, input.firstReload.turn)
  const secondReload = await input.alice.client.gameplay.getPlayerView.query({ gameId: input.fixture.gameId })
  expect(required(secondReload.fleets.find(({ id }) => id === input.journey.id)).distanceToEnd).toBe(0.418312565270031)
  expect(required(secondReload.fleets.find(({ id }) => id === input.fixture.defender.id)).strength).toBe(20)
  expect(secondReload.resources[ResourceType.INFLUENCE].total).toBe(input.expectedInfluenceUncommitted)
  expect(secondReload.resources[ResourceType.FUEL].total).toBe(input.expectedFuelUncommitted)

  await input.processReadyTurn(input.fixture.gameId, secondReload.turn)
}

async function verifyArrivalView(input: VerifyArrivalViewInput): Promise<void> {
  const arrivalView = await input.alice.client.gameplay.getPlayerView.query({ gameId: input.fixture.gameId })
  expect(arrivalView.fleets.find(({ id }) => id === input.fixture.defender.id)).toBeUndefined()
  if (input.friendlyGuard === undefined) {
    expect(arrivalView.fleets.find(({ id }) => id === input.journey.id)).toMatchObject({
      strength: 10,
      originPlanetId: input.fixture.bobHome.id,
    })
  } else {
    expect(arrivalView.fleets.find(({ id }) => id === input.friendlyGuard?.id)).toMatchObject({
      id: input.friendlyGuard.id,
      name: input.friendlyGuard.name,
      strength: 17,
      originPlanetId: input.fixture.bobHome.id,
    })
    expect(arrivalView.fleets.find(({ id }) => id === input.journey.id)).toBeUndefined()
  }
  expect(required(arrivalView.actions.find(({ id }) => id === input.attackAction.id)).isInProgress).toBe(false)
  await input.processReadyTurn(input.fixture.gameId, arrivalView.turn)
  const afterEmptyTurn = await input.alice.client.gameplay.getPlayerView.query({ gameId: input.fixture.gameId })
  expect(afterEmptyTurn.fleets.find(({ id }) => id === (input.friendlyGuard?.id ?? input.journey.id))?.strength).toBe(
    input.friendlyGuard === undefined ? 10 : 17,
  )
  expect(afterEmptyTurn.actions.find(({ id }) => id === input.attackAction.id)).toMatchObject({
    selectedTargets: null,
    isInProgress: false,
  })
}

type VerifyBuildRoundInput = {
  clients: AuthenticatedApiClient[]
  gameId: GameId
  target: Planet
  bobHome: Planet
  turnProcessor: TurnProcessor
}

type VerifyDefenderInput = {
  defender: Fleet
  enemy: Fleet
  bob: AuthenticatedApiClient
  gameId: GameId
  builtView: PlayerView
  target: Planet
  clients: AuthenticatedApiClient[]
  turnProcessor: TurnProcessor
  alice: AuthenticatedApiClient
}

type VerifyCreateNearEnemySetupResultInput = {
  alice: AuthenticatedApiClient
  gameId: GameId
  playerIds: PlayerId[]
  defender: Fleet
  bobHome: Planet
  clients: AuthenticatedApiClient[]
  turnProcessor: TurnProcessor
  target: Planet
}

type VerifyBuildTurnInput = {
  alice: AuthenticatedApiClient
  gameId: GameId
  aliceHome: Planet
  bob: AuthenticatedApiClient
  bobHome: Planet
  processReadyTurn: (turn: number) => Promise<void>
}

type VerifyCreateAliceSourceSetupResultInput = {
  alice: AuthenticatedApiClient
  gameId: GameId
  alicePlayerId: PlayerId
  aliceHome: Planet
  bobPlayerId: PlayerId
  bobHome: Planet
  processReadyTurn: (turn: number) => Promise<void>
}

type VerifyJourneyInput = {
  journey: Fleet
  fixture: { gameId: number; aliceHome: Planet; bobHome: Planet; source: Fleet; defender: Fleet }
  firstReload: PlayerView
  expectedInfluenceUncommitted: number
  expectedFuelUncommitted: number
  processReadyTurn: (gameId: number, turn: number) => Promise<void>
  alice: AuthenticatedApiClient
}

type VerifyArrivalViewInput = {
  alice: AuthenticatedApiClient
  fixture: { gameId: number; aliceHome: Planet; bobHome: Planet; source: Fleet; defender: Fleet }
  friendlyGuard: undefined | Fleet
  journey: Fleet
  attackAction: Action
  processReadyTurn: (gameId: number, turn: number) => Promise<void>
}

async function createAttackActionSetup(input: CreateAttackActionSetupInput): Promise<CreateAttackActionSetupResult> {
  const beforeAttack = await input.alice.client.gameplay.getPlayerView.query({ gameId: input.fixture.gameId })
  const attackAction = beforeAttack.actions.find(({ actionDefinitionId }) => actionDefinitionId === SpeedTwoAssaultWorkerTest.id)
  Assert.isDefined(attackAction)
  await input.alice.client.gameplay.updateActionSubmission.mutate({
    gameId: input.fixture.gameId,
    turn: beforeAttack.turn,
    submittedActionTargets: getActionToSubmintegrationTest(
      beforeAttack,
      SpeedTwoAssaultWorkerTest.id,
      { source: input.fixture.source.id, destination: input.fixture.bobHome.id },
      { force: 30 },
    ),
  })
  const selectedView = await input.alice.client.gameplay.getPlayerView.query({ gameId: input.fixture.gameId })
  const expectedInfluenceUncommitted = input.moveFriendlyGuard ? 82 : 85
  const expectedFuelUncommitted = input.moveFriendlyGuard ? 96 : 99
  expect(selectedView.resources[ResourceType.INFLUENCE].uncommitted).toBe(expectedInfluenceUncommitted)
  expect(selectedView.resources[ResourceType.FUEL].uncommitted).toBe(expectedFuelUncommitted)

  // Act: lock the exact 5/1 Attack Move and verify its persisted remainder on every worker reload.
  await input.processReadyTurn(input.fixture.gameId, beforeAttack.turn)
  const firstReload = await input.alice.client.gameplay.getPlayerView.query({ gameId: input.fixture.gameId })
  const journey = firstReload.fleets.find(({ movement }) => movement?.submission.id === attackAction.id)
  Assert.isDefined(journey)
  return { attackAction, expectedInfluenceUncommitted, expectedFuelUncommitted, firstReload, journey }
}

type CreateAttackActionSetupInput = {
  alice: AuthenticatedApiClient
  fixture: { gameId: number; aliceHome: Planet; bobHome: Planet; source: Fleet; defender: Fleet }
  moveFriendlyGuard: false | true
  processReadyTurn: (gameId: number, turn: number) => Promise<void>
}

type CreateAttackActionSetupResult = {
  attackAction: Action
  expectedInfluenceUncommitted: number
  expectedFuelUncommitted: number
  firstReload: PlayerView
  journey: Fleet
}
