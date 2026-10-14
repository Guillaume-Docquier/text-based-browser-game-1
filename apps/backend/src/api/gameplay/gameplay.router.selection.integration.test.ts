import { Assert, branded, Logger, Result, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { createGameConfigurationStub } from "shared/domain/games/GameConfiguration.stub.ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import { TurnStatus } from "shared/domain/turns/TurnStatus.ts"
import { describe, expect } from "vitest"
import { createApiStub } from "#api/createApi.stub.ts"
import { ControlledClock } from "#lib/ControlledClock.ts"
import { ApiServer } from "#tests/ApiServer.ts"
import { integrationTest } from "#tests/vitest.integration.fixture.ts"
import { TurnsRepository } from "#turn-processing/turns.repository.ts"

describe("gameplay.router", () => {
  // This test suite is often failing, but only in the CI. Not sure if it is hanging or just taking longer.
  // If we get timeouts on a 20s budget, this is definitely hanging and there's an issue running on the CI that we should address.
  describe("updateReadiness", { timeout: 20_000 }, () => {
    integrationTest.for([true, false])("should set the player readiness to %s", async (isReady, { db }) => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub({ db }))
      const creator = await apiServer.createClient({ authenticated: true })
      const player = await apiServer.createClient({ authenticated: true })

      const { createdGameId } = await creator.client.games.create.mutate({
        configuration: createGameConfigurationStub({ mapGenerationSeed: 1234 }),
      })
      await player.client.games.join.mutate({ gameId: createdGameId }) // 2nd player to avoid turn processing on ready

      await creator.client.games.startGame.mutate({ gameId: createdGameId })
      const initialPlayerView = await creator.client.gameplay.getPlayerView.query({ gameId: createdGameId })

      // Act
      await creator.client.gameplay.updateReadiness.mutate({ gameId: createdGameId, turn: 1, isReady: !isReady }) // Making sure the status will change
      await creator.client.gameplay.updateReadiness.mutate({ gameId: createdGameId, turn: 1, isReady })

      // Assert
      const playerView = await creator.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      expect(playerView).toStrictEqual<typeof playerView>({
        ...initialPlayerView,
        player: {
          ...initialPlayerView.player,
          isReady,
        },
      })
    })

    integrationTest("should close the turn and submit for processing when all players are ready", async ({ db }) => {
      // Arrange
      const logger = Logger.get()
      const clock = new ControlledClock()
      const turnsRepository = new TurnsRepository({ db, logger })

      const apiServices = await createApiStub({ db, clock })
      using apiServer = new ApiServer(apiServices)
      const creator = await apiServer.createClient({ authenticated: true })
      const player = await apiServer.createClient({ authenticated: true })

      const { createdGameId } = await creator.client.games.create.mutate({
        configuration: createGameConfigurationStub({ mapGenerationSeed: 1234 }),
      })
      await player.client.games.join.mutate({ gameId: createdGameId })

      await creator.client.games.startGame.mutate({ gameId: createdGameId })
      const initialPlayerView = await creator.client.gameplay.getPlayerView.query({ gameId: createdGameId })

      // Act
      await player.client.gameplay.updateReadiness.mutate({ gameId: createdGameId, turn: 1, isReady: true })
      const playerViewWithOnePlayerReady = await creator.client.gameplay.getPlayerView.query({ gameId: createdGameId })

      await creator.client.gameplay.updateReadiness.mutate({ gameId: createdGameId, turn: 1, isReady: true })
      const playerViewWithAllPlayersReady = await creator.client.gameplay.getPlayerView.query({ gameId: createdGameId })

      // Assert
      const playerId = branded<PlayerId>(player.account.id)
      const initialPlayer = initialPlayerView.opponents[playerId]
      Assert.isDefined(initialPlayer)

      expect(playerViewWithOnePlayerReady).toStrictEqual<typeof playerViewWithAllPlayersReady>({
        ...initialPlayerView,
        opponents: {
          [playerId]: {
            ...initialPlayer,
            isReady: true,
          },
        },
      })
      expect(playerViewWithAllPlayersReady).toStrictEqual<typeof playerViewWithAllPlayersReady>({
        ...initialPlayerView,
        turnStatus: TurnStatus.AWAITING_PROCESSING,
        player: {
          ...initialPlayerView.player,
          isReady: true,
        },
        opponents: {
          [playerId]: {
            ...initialPlayer,
            isReady: true,
          },
        },
      })

      const turnForProcessing = await apiServices.createTransaction(
        async (tx) => await turnsRepository.getNextTurnForProcessing({ since: clock.now() }, tx),
      )
      expect(turnForProcessing).toStrictEqual<typeof turnForProcessing>(Result.Success(branded({ gameId: createdGameId, turn: 1 })))
    })

    integrationTest("should reject readiness for the wrong turn", async ({ db }) => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub({ db }))
      const creator = await apiServer.createClient({ authenticated: true })

      const { createdGameId } = await creator.client.games.create.mutate({
        configuration: createGameConfigurationStub({ mapGenerationSeed: 1234 }),
      })

      await creator.client.games.startGame.mutate({ gameId: createdGameId })
      const initialPlayerView = await creator.client.gameplay.getPlayerView.query({ gameId: createdGameId })

      // Act
      const updateReadiness = creator.client.gameplay.updateReadiness.mutate({ gameId: createdGameId, turn: 0, isReady: true })

      // Assert
      await expect(updateReadiness).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
      const playerView = await creator.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      expect(playerView).toStrictEqual<typeof playerView>(initialPlayerView)
    })

    integrationTest("should reject readiness past the deadline", async ({ db }) => {
      // Arrange
      const clock = new ControlledClock()
      using apiServer = new ApiServer(await createApiStub({ db, clock }))
      const creator = await apiServer.createClient({ authenticated: true })

      const turnInterval = Time.create(10, UnitOfTime.SECONDS)
      const { createdGameId } = await creator.client.games.create.mutate({
        configuration: createGameConfigurationStub({
          mapGenerationSeed: 1234,
          turnIntervalSeconds: Time.in(turnInterval, UnitOfTime.SECONDS),
        }),
      })

      await creator.client.games.startGame.mutate({ gameId: createdGameId })
      const initialPlayerView = await creator.client.gameplay.getPlayerView.query({ gameId: createdGameId })

      // Act
      clock.increment({ time: turnInterval })
      const updateReadiness = creator.client.gameplay.updateReadiness.mutate({ gameId: createdGameId, turn: 1, isReady: true })

      // Assert
      await expect(updateReadiness).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
      const playerView = await creator.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      expect(playerView).toStrictEqual<typeof playerView>(initialPlayerView)
    })

    integrationTest("should reject readiness for players not in the game", async ({ db }) => {
      // Arrange
      const clock = new ControlledClock()
      using apiServer = new ApiServer(await createApiStub({ db, clock }))
      const creator = await apiServer.createClient({ authenticated: true })
      const player = await apiServer.createClient({ authenticated: true }) // not in the game

      const { createdGameId } = await creator.client.games.create.mutate({
        configuration: createGameConfigurationStub({ mapGenerationSeed: 1234 }),
      })

      await creator.client.games.startGame.mutate({ gameId: createdGameId })
      const initialPlayerView = await creator.client.gameplay.getPlayerView.query({ gameId: createdGameId })

      // Act
      const updateReadiness = player.client.gameplay.updateReadiness.mutate({ gameId: createdGameId, turn: 1, isReady: true })

      // Assert
      await expect(updateReadiness).rejects.toMatchObject({ data: { code: "FORBIDDEN" } })
      const playerView = await creator.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      expect(playerView).toStrictEqual<typeof playerView>(initialPlayerView)
    })
  })
})
