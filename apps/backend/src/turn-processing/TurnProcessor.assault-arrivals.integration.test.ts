import { Assert, branded, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { createGameConfigurationStub } from "shared/domain/games/GameConfiguration.stub.ts"
import type { GameId } from "shared/domain/games/GameId.ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
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
  integrationTest("should treat a full outgoing fleet as absent when the real worker resolves a later enemy arrival", async ({ db }) => {
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
    for (let buildRound = 0; buildRound < 3; buildRound += 1) {
      const views = await Promise.all(clients.map(async ({ client }) => await client.gameplay.getPlayerView.query({ gameId })))
      for (const [ownerIndex, client] of clients.entries()) {
        const view = views[ownerIndex]
        const home = ownerIndex === 0 ? target : bobHome
        Assert.isDefined(view)
        if ((buildRound < 3 && ownerIndex === 0) || (buildRound < 2 && ownerIndex === 1)) {
          await client.client.gameplay.updateActionSubmission.mutate({
            gameId,
            turn: view.turn,
            submittedActionTargets: getActionToSubmintegrationTest(view, BuildFleetStandard.id, { planet: home.id }),
          })
        }
      }
      const view = views[0]
      Assert.isDefined(view)
      await processPublicTurn({ clients, gameId, turn: view.turn, turnProcessor })
    }
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
    expect(defender.strength).toBe(30)
    expect(enemy.strength).toBe(20)

    // Act: start a public enemy Attack Move and let its persisted movement advance to its literal final remainder.
    await bob.client.gameplay.updateActionSubmission.mutate({
      gameId,
      turn: builtView.turn,
      submittedActionTargets: getActionToSubmintegrationTest(
        await bob.client.gameplay.getPlayerView.query({ gameId }),
        AttackMoveTest.id,
        { fleet: enemy.id, planet: target.id },
        { strength: 20 },
      ),
    })
    await processPublicTurn({ clients, gameId, turn: builtView.turn, turnProcessor })
    for (let advance = 0; advance < 3; advance += 1) {
      const view = await alice.client.gameplay.getPlayerView.query({ gameId })
      await processPublicTurn({ clients, gameId, turn: view.turn, turnProcessor })
    }

    const createNearEnemySetupPhase1Result = await createNearEnemySetup({
      alice,
      gameId,
      playerIds,
      defender,
      bobHome,
      clients,
      turnProcessor,
      target,
    })
    const { nearEnemy, afterCombat } = createNearEnemySetupPhase1Result
    expect(afterCombat.actions.find(({ id }) => id === nearEnemy.movement?.submission.id)).toMatchObject({
      selectedTargets: null,
      isInProgress: false,
    })
  })

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

    for (let buildTurn = 1; buildTurn <= 5; buildTurn += 1) {
      const aliceView = await alice.client.gameplay.getPlayerView.query({ gameId })
      await alice.client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: aliceView.turn,
        submittedActionTargets: getActionToSubmintegrationTest(aliceView, BuildFleetStandard.id, { planet: aliceHome.id }),
      })
      if (buildTurn <= 2) {
        const bobView = await bob.client.gameplay.getPlayerView.query({ gameId })
        await bob.client.gameplay.updateActionSubmission.mutate({
          gameId,
          turn: bobView.turn,
          submittedActionTargets: getActionToSubmintegrationTest(bobView, BuildFleetStandard.id, { planet: bobHome.id }),
        })
      }
      await processReadyTurn(aliceView.turn)
    }

    const createAliceSourceSetupPhase2Result = await createAliceSourceSetup({
      alice,
      gameId,
      alicePlayerId,
      aliceHome,
      bobPlayerId,
      bobHome,
      processReadyTurn,
    })
    const { assaultAction } = createAliceSourceSetupPhase2Result

    const createAfterEmptyTurnSetupPhase3Result = await createAfterEmptyTurnSetup({
      ...createAliceSourceSetupPhase2Result,
      processReadyTurn,
      alice,
      gameId,
      alicePlayerId,
      bobHome,
      aliceHome,
    })
    const { afterEmptyTurn } = createAfterEmptyTurnSetupPhase3Result
    expect(afterEmptyTurn.actions.find(({ id }) => id === assaultAction.id)).toMatchObject({ selectedTargets: null, isInProgress: false })
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
            expect(movingView.fleets.find(({ id }) => id === fixture.defender.id)?.strength).toBe(20)
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
          expect(movingView.fleets.find(({ id }) => id === fixture.defender.id)?.strength).toBe(20)
        }

        const beforeAttack = await alice.client.gameplay.getPlayerView.query({ gameId: fixture.gameId })
        const attackAction = beforeAttack.actions.find(({ actionDefinitionId }) => actionDefinitionId === SpeedTwoAssaultWorkerTest.id)
        Assert.isDefined(attackAction)
        await alice.client.gameplay.updateActionSubmission.mutate({
          gameId: fixture.gameId,
          turn: beforeAttack.turn,
          submittedActionTargets: getActionToSubmintegrationTest(
            beforeAttack,
            SpeedTwoAssaultWorkerTest.id,
            { source: fixture.source.id, destination: fixture.bobHome.id },
            { force: 30 },
          ),
        })
        const selectedView = await alice.client.gameplay.getPlayerView.query({ gameId: fixture.gameId })
        const expectedInfluenceUncommitted = moveFriendlyGuard ? 82 : 85
        const expectedFuelUncommitted = moveFriendlyGuard ? 96 : 99
        expect(selectedView.resources[ResourceType.INFLUENCE].uncommitted).toBe(expectedInfluenceUncommitted)
        expect(selectedView.resources[ResourceType.FUEL].uncommitted).toBe(expectedFuelUncommitted)

        // Act: lock the exact 5/1 Attack Move and verify its persisted remainder on every worker reload.
        await processReadyTurn(fixture.gameId, beforeAttack.turn)
        const firstReload = await alice.client.gameplay.getPlayerView.query({ gameId: fixture.gameId })
        const journey = firstReload.fleets.find(({ movement }) => movement?.submission.id === attackAction.id)
        Assert.isDefined(journey)
        expect(journey).toMatchObject({ strength: 30, distanceToEnd: 2.418312565270031, destinationPlanetId: fixture.bobHome.id })
        expect(firstReload.fleets.find(({ id }) => id === fixture.defender.id)?.strength).toBe(20)
        expect(firstReload.resources[ResourceType.INFLUENCE]).toStrictEqual({
          total: expectedInfluenceUncommitted,
          uncommitted: expectedInfluenceUncommitted,
        })
        expect(firstReload.resources[ResourceType.FUEL]).toStrictEqual({
          total: expectedFuelUncommitted,
          uncommitted: expectedFuelUncommitted,
        })

        await processReadyTurn(fixture.gameId, firstReload.turn)
        const secondReload = await alice.client.gameplay.getPlayerView.query({ gameId: fixture.gameId })
        expect(secondReload.fleets.find(({ id }) => id === journey.id)?.distanceToEnd).toBe(0.418312565270031)
        expect(secondReload.fleets.find(({ id }) => id === fixture.defender.id)?.strength).toBe(20)
        expect(secondReload.resources[ResourceType.INFLUENCE].total).toBe(expectedInfluenceUncommitted)
        expect(secondReload.resources[ResourceType.FUEL].total).toBe(expectedFuelUncommitted)

        await processReadyTurn(fixture.gameId, secondReload.turn)
        // Assert: arrival combat preserves the correct owner, survivor identity, resources, and next-turn release.
        const arrivalView = await alice.client.gameplay.getPlayerView.query({ gameId: fixture.gameId })
        expect(arrivalView.fleets.find(({ id }) => id === fixture.defender.id)).toBeUndefined()
        if (friendlyGuard === undefined) {
          expect(arrivalView.fleets.find(({ id }) => id === journey.id)).toMatchObject({ strength: 10, originPlanetId: fixture.bobHome.id })
        } else {
          expect(arrivalView.fleets.find(({ id }) => id === friendlyGuard?.id)).toMatchObject({
            id: friendlyGuard.id,
            name: friendlyGuard.name,
            strength: 17,
            originPlanetId: fixture.bobHome.id,
          })
          expect(arrivalView.fleets.find(({ id }) => id === journey.id)).toBeUndefined()
        }
        expect(arrivalView.actions.find(({ id }) => id === attackAction.id)?.isInProgress).toBe(false)
        await processReadyTurn(fixture.gameId, arrivalView.turn)
        const afterEmptyTurn = await alice.client.gameplay.getPlayerView.query({ gameId: fixture.gameId })
        expect(afterEmptyTurn.fleets.find(({ id }) => id === (friendlyGuard?.id ?? journey.id))?.strength).toBe(
          friendlyGuard === undefined ? 10 : 17,
        )
        expect(afterEmptyTurn.actions.find(({ id }) => id === attackAction.id)).toMatchObject({
          selectedTargets: null,
          isInProgress: false,
        })
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

function assertFirstJourney({
  firstJourney,
  bobHome,
  readyForAttack,
  assaultAction,
  alicePlayerId,
  aliceSource,
  firstRemainder,
  aliceHome,
  firstSavedView,
  bobDefender,
}: AssertFirstJourneyInput): void {
  expect(firstJourney).toMatchObject({ strength: 30, distanceToEnd: 2.418312565270031, destinationPlanetId: bobHome.id })
  expect(firstJourney.movement).toMatchObject({
    speed: 2,
    departureTurn: readyForAttack.turn,
    submission: {
      id: assaultAction.id,
      playerId: alicePlayerId,
      actionDefinitionId: FlexibleAssaultTest.id,
      selectedTargets: { source: aliceSource.id, destination: bobHome.id },
      selectedInputs: { force: 30 },
    },
    pendingArrivalEffects: [{ definitionOrdinal: 3, effectDefinition: { type: "FLEET_ASSAULT" } }],
  })
  expect(firstRemainder).toMatchObject({ strength: 20, originPlanetId: aliceHome.id })
  expect(firstSavedView.actions.find(({ id }) => id === assaultAction.id)?.isInProgress).toBe(true)
  expect(firstSavedView.fleets.find(({ id }) => id === bobDefender.id)?.strength).toBe(20)
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

async function createNearEnemySetup({
  alice,
  gameId,
  playerIds,
  defender,
  bobHome,
  clients,
  turnProcessor,
  target,
}: CreateNearEnemySetupInput): Promise<CreateNearEnemySetupResult> {
  const arrivalView = await alice.client.gameplay.getPlayerView.query({ gameId })
  const nearEnemy = arrivalView.fleets.find(({ ownerPlayerId, movement }) => ownerPlayerId === playerIds[1] && movement !== undefined)
  Assert.isDefined(nearEnemy)
  expect(nearEnemy.distanceToEnd).toBe(0.418312565270031)
  expect(arrivalView.fleets.find(({ id }) => id === defender.id)?.strength).toBe(30)

  // Act: move all thirty defender Strength away through a public ordinary Move while the enemy Assault arrives.
  await alice.client.gameplay.updateActionSubmission.mutate({
    gameId,
    turn: arrivalView.turn,
    submittedActionTargets: getActionToSubmintegrationTest(
      arrivalView,
      MoveFleetStandard.id,
      { fleet: defender.id, planet: bobHome.id },
      { strength: 30 },
    ),
  })
  await processPublicTurn({ clients, gameId, turn: arrivalView.turn, turnProcessor })

  // Assert: the transit-origin fleet does not defend the target; the Assault resolves as an empty-target no-op.
  const afterCombat = await alice.client.gameplay.getPlayerView.query({ gameId })
  const outbound = afterCombat.fleets.find(({ ownerPlayerId, movement }) => ownerPlayerId === playerIds[0] && movement !== undefined)
  const arrivedEnemy = afterCombat.fleets.find(
    ({ ownerPlayerId, originPlanetId, movement }) =>
      ownerPlayerId === playerIds[1] && originPlanetId === target.id && movement === undefined,
  )
  Assert.isDefined(outbound)
  Assert.isDefined(arrivedEnemy)
  expect(outbound).toMatchObject({
    strength: 30,
    originPlanetId: target.id,
    destinationPlanetId: bobHome.id,
    movement: { speed: 0.1 },
    distanceToEnd: 4.318312565270031,
  })
  expect(afterCombat.fleets.find(({ id }) => id === defender.id)).toBeUndefined()
  expect(arrivedEnemy.strength).toBe(20)
  return { nearEnemy, afterCombat }
}

async function createAliceSourceSetup({
  alice,
  gameId,
  alicePlayerId,
  aliceHome,
  bobPlayerId,
  bobHome,
  processReadyTurn,
}: CreateAliceSourceSetupInput): Promise<CreateAliceSourceSetupResult> {
  const readyForAttack = await alice.client.gameplay.getPlayerView.query({ gameId })
  const aliceSource = readyForAttack.fleets.find(
    ({ ownerPlayerId, originPlanetId, movement }) =>
      ownerPlayerId === alicePlayerId && originPlanetId === aliceHome.id && movement === undefined,
  )
  const bobDefender = readyForAttack.fleets.find(
    ({ ownerPlayerId, originPlanetId, movement }) =>
      ownerPlayerId === bobPlayerId && originPlanetId === bobHome.id && movement === undefined,
  )
  Assert.isDefined(aliceSource)
  Assert.isDefined(bobDefender)
  expect(aliceSource.strength).toBe(50)
  expect(bobDefender.strength).toBe(20)
  const assaultAction = readyForAttack.actions.find(({ actionDefinitionId }) => actionDefinitionId === FlexibleAssaultTest.id)
  Assert.isDefined(assaultAction)

  // Act: submit the composed departure through the public API and advance it through the production worker.
  await alice.client.gameplay.updateActionSubmission.mutate({
    gameId,
    turn: readyForAttack.turn,
    submittedActionTargets: getActionToSubmintegrationTest(
      readyForAttack,
      FlexibleAssaultTest.id,
      { source: aliceSource.id, destination: bobHome.id },
      { force: 30 },
    ),
  })
  const selectedView = await alice.client.gameplay.getPlayerView.query({ gameId })
  expect(selectedView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 90, uncommitted: 83 })
  expect(selectedView.resources[ResourceType.FUEL]).toStrictEqual({ total: 100, uncommitted: 98 })
  expect(selectedView.fleets.find(({ id }) => id === aliceSource.id)?.strength).toBe(50)

  // Assert: the public readiness API closes the turn; the real resolver saves through the worker repository.
  await processReadyTurn(readyForAttack.turn)
  const firstSavedView = await alice.client.gameplay.getPlayerView.query({ gameId })
  const firstJourney = firstSavedView.fleets.find(({ movement }) => movement?.submission.id === assaultAction.id)
  const firstRemainder = firstSavedView.fleets.find(({ id }) => id === aliceSource.id)
  Assert.isDefined(firstJourney)
  Assert.isDefined(firstJourney.movement)
  Assert.isDefined(firstRemainder)

  assertFirstJourney({
    firstJourney,
    bobHome,
    readyForAttack,
    assaultAction,
    alicePlayerId,
    aliceSource,
    firstRemainder,
    aliceHome,
    firstSavedView,
    bobDefender,
  })
  return { aliceSource, bobDefender, assaultAction, firstSavedView, firstJourney }
}

async function createAfterEmptyTurnSetup({
  processReadyTurn,
  firstSavedView,
  alice,
  gameId,
  firstJourney,
  bobDefender,
  alicePlayerId,
  bobHome,
  aliceSource,
  aliceHome,
  assaultAction,
}: CreateAfterEmptyTurnSetupInput): Promise<CreateAfterEmptyTurnSetupResult> {
  await processReadyTurn(firstSavedView.turn)
  const secondSavedView = await alice.client.gameplay.getPlayerView.query({ gameId })
  const secondJourney = secondSavedView.fleets.find(({ id }) => id === firstJourney.id)
  Assert.isDefined(secondJourney)
  expect(secondJourney.distanceToEnd).toBe(0.418312565270031)
  expect(secondSavedView.fleets.find(({ id }) => id === bobDefender.id)?.strength).toBe(20)
  expect(secondSavedView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 83, uncommitted: 83 })
  expect(secondSavedView.resources[ResourceType.FUEL]).toStrictEqual({ total: 98, uncommitted: 98 })

  await processReadyTurn(secondSavedView.turn)
  const arrivalView = await alice.client.gameplay.getPlayerView.query({ gameId })
  const arrivedFleet = arrivalView.fleets.find(({ id }) => id === firstJourney.id)
  Assert.isDefined(arrivedFleet)
  expect(arrivedFleet).toStrictEqual({
    id: firstJourney.id,
    name: firstJourney.name,
    ownerPlayerId: alicePlayerId,
    strength: 10,
    originPlanetId: bobHome.id,
  })
  expect(arrivalView.fleets.find(({ id }) => id === bobDefender.id)).toBeUndefined()
  expect(arrivalView.fleets.find(({ id }) => id === aliceSource.id)).toMatchObject({ strength: 20, originPlanetId: aliceHome.id })
  expect(arrivalView.actions.find(({ id }) => id === assaultAction.id)?.isInProgress).toBe(false)
  expect(arrivalView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 83, uncommitted: 83 })
  expect(arrivalView.resources[ResourceType.FUEL]).toStrictEqual({ total: 98, uncommitted: 98 })

  await processReadyTurn(arrivalView.turn)
  const afterEmptyTurn = await alice.client.gameplay.getPlayerView.query({ gameId })
  expect(afterEmptyTurn.fleets.find(({ id }) => id === firstJourney.id)?.strength).toBe(10)
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
