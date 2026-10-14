import { Assert, branded, Datetime, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { createGameConfigurationStub } from "shared/domain/games/GameConfiguration.stub.ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import { AttackMoveTest, FlexibleAssaultTest, StationaryAssaultTest } from "shared/testing/test-ruleset/action-definitions/attack-move.ts"
import {
  BuildFleetExceptional,
  BuildFleetImproved,
  BuildFleetStandard,
} from "shared/testing/test-ruleset/action-definitions/build-fleet.ts"
import { ColonizeHereTest, ColonizePlanetTest } from "shared/testing/test-ruleset/action-definitions/colonize.ts"
import { GainEnergy } from "shared/testing/test-ruleset/action-definitions/gain-energy.ts"
import { GainFuel } from "shared/testing/test-ruleset/action-definitions/gain-fuel.ts"
import { GainInfluence } from "shared/testing/test-ruleset/action-definitions/gain-influence.ts"
import { GainMetal } from "shared/testing/test-ruleset/action-definitions/gain-metal.ts"
import { MoveFleetExceptional, MoveFleetImproved, MoveFleetStandard } from "shared/testing/test-ruleset/action-definitions/move-fleet.ts"
import { WinTheGame } from "shared/testing/test-ruleset/action-definitions/win-the-game.ts"
import { describe, expect } from "vitest"
import { createApiStub } from "#api/createApi.stub.ts"
import { ControlledClock } from "#lib/ControlledClock.ts"
import { ApiServer } from "#tests/ApiServer.ts"
import { ResourcesRepository } from "#tests/resources/resources.repository.ts"
import { integrationTest } from "#tests/vitest.integration.fixture.ts"
import { createTurnProcessorStub } from "#turn-processing/TurnProcessor.stub.ts"
import {
  assertTurnProcessor2,
  assertReturnView,
  assertPersistedDefenderHome,
} from "../tests/fleet-assertions/TurnProcessor.assault-sources-2.ts"
import { getActionToSubmintegrationTest, FailingTurnsRepository } from "../tests/fleet-worker/TurnProcessor.scenarios.ts"
import { EnemyArrivalRuleset } from "../tests/fleet-worker/TurnProcessor.ts"

describe("TurnProcessor", () => {
  describe("processNextDueTurn", () => {
    integrationTest("should merge an arriving fleet with the player's fleet at the destination in one turn", async ({ db }) => {
      // Arrange
      const clock = new ControlledClock()
      using apiServer = new ApiServer(await createApiStub({ db, clock }))
      const player = await apiServer.createClient({ authenticated: true })
      const turnInterval = Time.create(10, UnitOfTime.SECONDS)
      const { createdGameId: gameId } = await player.client.games.create.mutate({
        configuration: createGameConfigurationStub({
          turnIntervalSeconds: Time.in(turnInterval, UnitOfTime.SECONDS),
          mapGenerationSeed: 1234,
        }),
      })
      await player.client.games.startGame.mutate({ gameId })
      const initialView = await player.client.gameplay.getPlayerView.query({ gameId })
      const planets = initialView.galaxy.systems.flatMap(({ planets }) => planets)
      const homePlanet = planets.find(({ ownerPlayerId }) => ownerPlayerId === branded(player.account.id))
      Assert.isDefined(homePlanet)
      // This planet shares the home system, so an improved move takes one turn.
      const nearbyPlanet = planets.find(({ coordinates }) => coordinates === "45:98:25")
      Assert.isDefined(nearbyPlanet)
      const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db, clock })

      await assertTurnProcessor2({ player, gameId, initialView, clock, turnInterval, turnsRepository, turnProcessor, homePlanet })
      const builtView = await player.client.gameplay.getPlayerView.query({ gameId })
      const movingFleet = builtView.fleets[0]
      Assert.isDefined(movingFleet)
      expect(builtView.fleets).toHaveLength(1)

      // Move the first fleet away, then build a second fleet at home.
      await player.client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: builtView.turn,
        submittedActionTargets: getActionToSubmintegrationTest(
          builtView,
          MoveFleetImproved.id,
          {
            fleet: movingFleet.id,
            planet: nearbyPlanet.id,
          },
          { strength: movingFleet.strength },
        ),
      })
      clock.increment({ time: turnInterval })
      await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
      expect(await turnProcessor.processNextDueTurn()).toBe("processed")
      const awayView = await player.client.gameplay.getPlayerView.query({ gameId })
      expect(awayView.fleets).toHaveLength(1)
      const departedFleet = awayView.fleets[0]
      Assert.isDefined(departedFleet)
      expect(departedFleet).toMatchObject({ originPlanetId: nearbyPlanet.id, strength: movingFleet.strength })
      expect(departedFleet.id).not.toBe(movingFleet.id)

      await player.client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: awayView.turn,
        submittedActionTargets: getActionToSubmintegrationTest(awayView, BuildFleetStandard.id, { planet: homePlanet.id }),
      })
      clock.increment({ time: turnInterval })
      await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
      expect(await turnProcessor.processNextDueTurn()).toBe("processed")
      const returnView = await player.client.gameplay.getPlayerView.query({ gameId })
      const stationedFleet = returnView.fleets.find(({ originPlanetId }) => originPlanetId === homePlanet.id)
      Assert.isDefined(stationedFleet)

      await assertReturnView({
        returnView,
        stationedFleet,
        movingFleet,
        player,
        gameId,
        departedFleet,
        homePlanet,
        clock,
        turnInterval,
        turnsRepository,
        turnProcessor,
      })
    })

    integrationTest("should persist an ordinary arrival separately from an enemy fleet at the destination", async ({ db }) => {
      // Arrange
      const clock = new ControlledClock()
      const apiServices = await createApiStub({ db, clock })
      Assert.isSuccess(await apiServices.rulesetsRepository.upsertRuleset(EnemyArrivalRuleset))
      using apiServer = new ApiServer(apiServices)
      const attacker = await apiServer.createClient({ authenticated: true })
      const defender = await apiServer.createClient({ authenticated: true })
      const turnInterval = Time.create(10, UnitOfTime.SECONDS)
      const { createdGameId: gameId } = await attacker.client.games.create.mutate({
        configuration: createGameConfigurationStub({
          rulesetId: EnemyArrivalRuleset.id,
          nbSeats: 2,
          turnIntervalSeconds: Time.in(turnInterval, UnitOfTime.SECONDS),
          mapGenerationSeed: 1234,
        }),
      })
      await defender.client.games.join.mutate({ gameId })
      await attacker.client.games.startGame.mutate({ gameId })
      const attackerInitialView = await attacker.client.gameplay.getPlayerView.query({ gameId })
      const defenderInitialView = await defender.client.gameplay.getPlayerView.query({ gameId })
      const planets = attackerInitialView.galaxy.systems.flatMap(({ planets }) => planets)
      const attackerPlayerId = branded<PlayerId>(attacker.account.id)
      const defenderPlayerId = branded<PlayerId>(defender.account.id)
      const attackerHome = planets.find(({ ownerPlayerId }) => ownerPlayerId === attackerPlayerId)
      const defenderHome = planets.find(({ ownerPlayerId }) => ownerPlayerId === defenderPlayerId)
      Assert.isDefined(attackerHome)
      Assert.isDefined(defenderHome)
      const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db, clock })

      await attacker.client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: attackerInitialView.turn,
        submittedActionTargets: getActionToSubmintegrationTest(attackerInitialView, BuildFleetStandard.id, { planet: attackerHome.id }),
      })
      await defender.client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: defenderInitialView.turn,
        submittedActionTargets: getActionToSubmintegrationTest(defenderInitialView, BuildFleetImproved.id, { planet: defenderHome.id }),
      })
      clock.increment({ time: turnInterval })
      await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
      expect(await turnProcessor.processNextDueTurn()).toBe("processed")
      const attackerBuiltView = await attacker.client.gameplay.getPlayerView.query({ gameId })
      const defenderBuiltView = await defender.client.gameplay.getPlayerView.query({ gameId })
      const attackingFleet = attackerBuiltView.fleets.find(({ ownerPlayerId }) => ownerPlayerId === attackerPlayerId)
      const defendingFleet = defenderBuiltView.fleets.find(({ ownerPlayerId }) => ownerPlayerId === defenderPlayerId)
      const moveAction = attackerBuiltView.actions.find(({ actionDefinitionId }) => actionDefinitionId === MoveFleetStandard.id)
      Assert.isDefined(attackingFleet)
      Assert.isDefined(defendingFleet)
      Assert.isDefined(moveAction)
      expect(attackingFleet).toMatchObject({ strength: 20, originPlanetId: attackerHome.id })
      expect(defendingFleet).toMatchObject({ strength: 7, originPlanetId: defenderHome.id })

      // Act: the public API accepts a normal move; the worker processes its immediate arrival.
      await attacker.client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: attackerBuiltView.turn,
        submittedActionTargets: getActionToSubmintegrationTest(
          attackerBuiltView,
          MoveFleetStandard.id,
          { fleet: attackingFleet.id, planet: defenderHome.id },
          { strength: 20 },
        ),
      })
      clock.increment({ time: turnInterval })
      await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
      expect(await turnProcessor.processNextDueTurn()).toBe("processed")

      // Assert: the reloaded public view retains the enemy row unchanged and the arriving force separately.
      const resolvedView = await attacker.client.gameplay.getPlayerView.query({ gameId })
      const persistedDefenderHome = resolvedView.galaxy.systems.flatMap(({ planets }) => planets).find(({ id }) => id === defenderHome.id)
      const persistedEnemyFleet = resolvedView.fleets.find(({ id }) => id === defendingFleet.id)
      const persistedArrival = resolvedView.fleets.find(
        ({ ownerPlayerId, id }) => ownerPlayerId === attackerPlayerId && id !== attackingFleet.id,
      )
      Assert.isDefined(persistedEnemyFleet)
      Assert.isDefined(persistedArrival)
      Assert.isDefined(persistedDefenderHome)

      assertPersistedDefenderHome({
        persistedDefenderHome,
        defenderPlayerId,
        resolvedView,
        persistedEnemyFleet,
        defendingFleet,
        defenderHome,
        persistedArrival,
        attackerPlayerId,
        attackingFleet,
        moveAction,
      })
    })

    integrationTest.for([
      { turnInterval: Time.create(100, UnitOfTime.SECONDS), timeIncrement: Time.create(116, UnitOfTime.SECONDS) },
      { turnInterval: Time.create(100, UnitOfTime.MINUTES), timeIncrement: Time.create(103, UnitOfTime.MINUTES) },
    ])(
      "should schedule the next turn from the current time when the delay exceeds 15 percent of the interval, capped at 2 minutes",
      async ({ turnInterval, timeIncrement }, { db }) => {
        // Arrange
        const clock = new ControlledClock()
        using apiServer = new ApiServer(await createApiStub({ db, clock }))
        const player = await apiServer.createClient({ authenticated: true })

        const { createdGameId } = await player.client.games.create.mutate({
          configuration: createGameConfigurationStub({ turnIntervalSeconds: Time.in(turnInterval, UnitOfTime.SECONDS) }),
        })
        await player.client.games.startGame.mutate({ gameId: createdGameId })

        const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db, clock })

        // Act
        clock.increment({ time: timeIncrement })
        await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
        await turnProcessor.processNextDueTurn()

        // Assert
        expect(await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })).toMatchObject({
          turn: 2,
          turnEndsAt: Datetime.increment({ date: clock.now(), time: turnInterval }).toISOString(),
        })
      },
    )

    integrationTest("should fail the turn when a locked action submission is no longer affordable", async ({ db }) => {
      // Arrange
      const clock = new ControlledClock()
      const { api, accountsRepository, logger } = await createApiStub({ db, clock })
      using apiServer = new ApiServer({ api, accountsRepository })
      const player = await apiServer.createClient({ authenticated: true })
      const { createdGameId } = await player.client.games.create.mutate({
        configuration: createGameConfigurationStub({ turnIntervalSeconds: 10 }),
      })
      await player.client.games.startGame.mutate({ gameId: createdGameId })

      const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db, clock })
      const resourcesRepository = new ResourcesRepository({ db, logger })
      const initialPlayerView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })

      await player.client.gameplay.updateActionSubmission.mutate({
        gameId: createdGameId,
        turn: 1,
        submittedActionTargets: getActionToSubmintegrationTest(initialPlayerView, GainMetal.id),
      })
      Assert.isSuccess(
        await resourcesRepository.updateResource({
          gameId: createdGameId,
          playerId: branded(player.account.id),
          resourceType: ResourceType.INFLUENCE,
          amountDelta: -3,
        }),
      )

      // Act
      clock.increment({ time: Time.create(10, UnitOfTime.SECONDS) })
      await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
      const result = await turnProcessor.processNextDueTurn()

      // Assert
      expect(result).toBe("failed")
    })

    integrationTest("should process only the earliest scheduled turn in one invocation", async ({ db }) => {
      // Arrange
      const clock = new ControlledClock()
      using apiServer = new ApiServer(await createApiStub({ db, clock }))
      const player = await apiServer.createClient({ authenticated: true })

      // later game
      const laterTurnInterval = Time.create(100, UnitOfTime.SECONDS)
      const { createdGameId: laterGameId } = await player.client.games.create.mutate({
        configuration: createGameConfigurationStub({ turnIntervalSeconds: Time.in(laterTurnInterval, UnitOfTime.SECONDS) }),
      })
      await player.client.games.startGame.mutate({ gameId: laterGameId })

      // earlier game
      const earlierTurnInterval = Time.create(50, UnitOfTime.SECONDS)
      const { createdGameId: earlierGameId } = await player.client.games.create.mutate({
        configuration: createGameConfigurationStub({ turnIntervalSeconds: Time.in(earlierTurnInterval, UnitOfTime.SECONDS) }),
      })
      await player.client.games.startGame.mutate({ gameId: earlierGameId })

      const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db, clock })

      // Act
      clock.increment({ time: Time.create(200, UnitOfTime.SECONDS) })
      await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
      await turnProcessor.processNextDueTurn()

      // Assert
      expect(await player.client.gameplay.getPlayerView.query({ gameId: laterGameId })).toMatchObject({
        turn: 1,
        resources: { [ResourceType.INFLUENCE]: { total: 3, uncommitted: 3 } },
      })

      expect(await player.client.gameplay.getPlayerView.query({ gameId: earlierGameId })).toMatchObject({
        turn: 2,
        resources: { [ResourceType.INFLUENCE]: { total: 3, uncommitted: 3 } },
      })
    })

    integrationTest("should be able to process the same turn over time", async ({ db }) => {
      // Arrange
      const clock = new ControlledClock()
      using apiServer = new ApiServer(await createApiStub({ db, clock }))
      const player = await apiServer.createClient({ authenticated: true })

      const turnInterval = Time.create(50, UnitOfTime.SECONDS)
      const { createdGameId: gameId } = await player.client.games.create.mutate({
        configuration: createGameConfigurationStub({ turnIntervalSeconds: Time.in(turnInterval, UnitOfTime.SECONDS) }),
      })
      await player.client.games.startGame.mutate({ gameId })

      const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db, clock })

      // Act
      clock.increment({ time: turnInterval })
      await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
      await turnProcessor.processNextDueTurn()

      clock.increment({ time: turnInterval })
      await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
      await turnProcessor.processNextDueTurn()

      // Assert
      expect(await player.client.gameplay.getPlayerView.query({ gameId })).toMatchObject({
        turn: 3,
        resources: { [ResourceType.INFLUENCE]: { total: 3, uncommitted: 3 } },
      })
    })

    integrationTest("should skip turns that are already processing", async ({ db }) => {
      // Arrange
      const clock = new ControlledClock()
      using apiServer = new ApiServer(await createApiStub({ db, clock }))
      const player = await apiServer.createClient({ authenticated: true })

      const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db, clock })

      const processingTurnInterval = Time.create(50, UnitOfTime.SECONDS)
      const { createdGameId: processingGameId } = await player.client.games.create.mutate({
        configuration: createGameConfigurationStub({ turnIntervalSeconds: Time.in(processingTurnInterval, UnitOfTime.SECONDS) }),
      })
      await player.client.games.startGame.mutate({ gameId: processingGameId })

      // Act
      clock.increment({ time: processingTurnInterval })
      await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
      const processingResults = await Promise.all([turnProcessor.processNextDueTurn(), turnProcessor.processNextDueTurn()])

      // Assert
      expect(processingResults).toStrictEqual<typeof processingResults>(["processed", "idle"])
      expect(await player.client.gameplay.getPlayerView.query({ gameId: processingGameId })).toMatchObject({
        turn: 2,
        resources: { [ResourceType.INFLUENCE]: { total: 3, uncommitted: 3 } },
      })
    })

    integrationTest("should not process another turn when the selected turn processing fails", async ({ db }) => {
      // Arrange
      const clock = new ControlledClock()
      const { api, accountsRepository, logger } = await createApiStub({ db, clock })
      using apiServer = new ApiServer({ api, accountsRepository })
      const player = await apiServer.createClient({ authenticated: true })

      const failingTurnInterval = Time.create(50, UnitOfTime.SECONDS)
      const { createdGameId: failingGameId } = await player.client.games.create.mutate({
        configuration: createGameConfigurationStub({ turnIntervalSeconds: Time.in(failingTurnInterval, UnitOfTime.SECONDS) }),
      })
      await player.client.games.startGame.mutate({ gameId: failingGameId })

      const successfulTurnInterval = Time.create(100, UnitOfTime.SECONDS)
      const { createdGameId: successfulGameId } = await player.client.games.create.mutate({
        configuration: createGameConfigurationStub({ turnIntervalSeconds: Time.in(successfulTurnInterval, UnitOfTime.SECONDS) }),
      })
      await player.client.games.startGame.mutate({ gameId: successfulGameId })

      const turnsRepository = new FailingTurnsRepository({ db, logger, failingGameId })
      const { turnProcessor } = await createTurnProcessorStub({ db, clock, turnsRepository })

      // Act
      clock.increment({ time: successfulTurnInterval })
      await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
      await turnProcessor.processNextDueTurn()

      // Assert
      expect(await player.client.gameplay.getPlayerView.query({ gameId: failingGameId })).toMatchObject({
        turn: 1,
        resources: { [ResourceType.INFLUENCE]: { total: 3, uncommitted: 3 } },
      })

      expect(await player.client.gameplay.getPlayerView.query({ gameId: successfulGameId })).toMatchObject({
        turn: 1,
        resources: { [ResourceType.INFLUENCE]: { total: 3, uncommitted: 3 } },
      })
    })

    integrationTest("should be able to process turns in parallel", async ({ db }) => {
      // Arrange
      const clock = new ControlledClock()
      using apiServer = new ApiServer(await createApiStub({ db, clock }))
      const player = await apiServer.createClient({ authenticated: true })

      const earlierTurnInterval = Time.create(50, UnitOfTime.SECONDS)
      const { createdGameId: earlierGameId } = await player.client.games.create.mutate({
        configuration: createGameConfigurationStub({ turnIntervalSeconds: Time.in(earlierTurnInterval, UnitOfTime.SECONDS) }),
      })
      await player.client.games.startGame.mutate({ gameId: earlierGameId })

      const laterTurnInterval = Time.create(100, UnitOfTime.SECONDS)
      const { createdGameId: laterGameId } = await player.client.games.create.mutate({
        configuration: createGameConfigurationStub({ turnIntervalSeconds: Time.in(laterTurnInterval, UnitOfTime.SECONDS) }),
      })
      await player.client.games.startGame.mutate({ gameId: laterGameId })

      const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db, clock })

      // Act
      clock.increment({ time: laterTurnInterval })

      // if rows are locked correctly, processing 2 turns concurrently should result in 2 different turns being processed
      await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
      await Promise.all([turnProcessor.processNextDueTurn(), turnProcessor.processNextDueTurn()])

      // Assert
      expect(await player.client.gameplay.getPlayerView.query({ gameId: earlierGameId })).toMatchObject({
        turn: 2,
        resources: { [ResourceType.INFLUENCE]: { total: 3, uncommitted: 3 } },
      })

      expect(await player.client.gameplay.getPlayerView.query({ gameId: laterGameId })).toMatchObject({
        turn: 2,
        resources: { [ResourceType.INFLUENCE]: { total: 3, uncommitted: 3 } },
      })
    })

    integrationTest("should do nothing if there are no turns left when processing turns in parallel", async ({ db }) => {
      // Arrange
      const clock = new ControlledClock()
      using apiServer = new ApiServer(await createApiStub({ db, clock }))
      const player = await apiServer.createClient({ authenticated: true })

      const turnInterval = Time.create(50, UnitOfTime.SECONDS)
      const { createdGameId: gameId } = await player.client.games.create.mutate({
        configuration: createGameConfigurationStub({ turnIntervalSeconds: Time.in(turnInterval, UnitOfTime.SECONDS) }),
      })
      await player.client.games.startGame.mutate({ gameId })

      const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db, clock })

      // Act
      clock.increment({ time: turnInterval })
      await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
      // if rows are locked correctly, processing 2 turns concurrently should result in 1 turn being processed and the other one will do nothing
      await Promise.all([turnProcessor.processNextDueTurn(), turnProcessor.processNextDueTurn()])

      // Assert
      expect(await player.client.gameplay.getPlayerView.query({ gameId })).toMatchObject({
        turn: 2,
        resources: { [ResourceType.INFLUENCE]: { total: 3, uncommitted: 3 } },
      })
    })

    integrationTest("should fully process every player and select at most one deterministic winner", async ({ db }) => {
      // Arrange
      const clock = new ControlledClock()
      const { api, accountsRepository, logger } = await createApiStub({ db, clock })
      using apiServer = new ApiServer({ api, accountsRepository })
      const creator = await apiServer.createClient({ authenticated: true })
      const joiner = await apiServer.createClient({ authenticated: true })

      const { createdGameId } = await creator.client.games.create.mutate({
        configuration: createGameConfigurationStub({ turnIntervalSeconds: 10 }),
      })
      await joiner.client.games.join.mutate({ gameId: createdGameId })
      await creator.client.games.startGame.mutate({ gameId: createdGameId })

      const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db, clock })
      const resourcesRepository = new ResourcesRepository({ db, logger })

      for (const { player, amountDelta } of [
        { player: creator, amountDelta: 10 },
        { player: joiner, amountDelta: 12 },
      ]) {
        for (const resourceType of [ResourceType.INFLUENCE, ResourceType.METAL, ResourceType.FUEL, ResourceType.ENERGY]) {
          const updateResourceResult = await resourcesRepository.updateResource({
            gameId: createdGameId,
            playerId: branded(player.account.id),
            resourceType,
            amountDelta,
          })
          Assert.isSuccess(updateResourceResult)
        }
        const playerView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })

        await player.client.gameplay.updateActionSubmission.mutate({
          gameId: createdGameId,
          turn: 1,
          submittedActionTargets: getActionToSubmintegrationTest(playerView, WinTheGame.id),
        })
      }

      const creatorViewBeforeProcessing = await creator.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      const joinerViewBeforeProcessing = await joiner.client.gameplay.getPlayerView.query({ gameId: createdGameId })

      // Act
      clock.increment({ time: Time.create(10, UnitOfTime.SECONDS) })
      await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
      await turnProcessor.processNextDueTurn()

      // Assert
      // Eventually we'll have a turn order that will change during the game, for now the players are sorted by their id
      const expectedWinnerId = [creator.account.id, joiner.account.id].sort()[0]
      const postSpendAffordability = {
        [GainInfluence.id]: true,
        [WinTheGame.id]: false,
        [GainEnergy.id]: true,
        [GainFuel.id]: true,
        [GainMetal.id]: true,
        [BuildFleetStandard.id]: true,
        [BuildFleetImproved.id]: false,
        [BuildFleetExceptional.id]: false,
        [MoveFleetStandard.id]: true,
        [MoveFleetImproved.id]: true,
        [MoveFleetExceptional.id]: true,
        [AttackMoveTest.id]: false,
        [FlexibleAssaultTest.id]: false,
        [StationaryAssaultTest.id]: true,
        [ColonizeHereTest.id]: false,
        [ColonizePlanetTest.id]: false,
      }
      const joinerPostSpendAffordability = { ...postSpendAffordability, [AttackMoveTest.id]: true }

      const lobby = await creator.client.games.getById.query({ gameId: createdGameId })
      expect(lobby).toMatchObject({
        winnerAccountId: expectedWinnerId,
        endedAt: expect.any(String),
      })

      const creatorView = await creator.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      expect(creatorView).toMatchObject({
        turn: 1,
        turnStatus: "COMPLETED",
        resources: {
          [ResourceType.INFLUENCE]: { total: 3, uncommitted: 3 },
        },
        actions: creatorViewBeforeProcessing.actions.map((action) => ({
          ...action,
          canAfford: postSpendAffordability[action.actionDefinitionId],
        })),
      })

      const joinerView = await joiner.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      expect(joinerView).toMatchObject({
        turn: 1,
        turnStatus: "COMPLETED",
        resources: {
          [ResourceType.INFLUENCE]: { total: 5, uncommitted: 5 },
        },
        actions: joinerViewBeforeProcessing.actions.map((action) => ({
          ...action,
          canAfford: joinerPostSpendAffordability[action.actionDefinitionId],
        })),
      })
    })
  })
})
