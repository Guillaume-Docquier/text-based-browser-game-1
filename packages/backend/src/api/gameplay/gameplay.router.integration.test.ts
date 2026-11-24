import { createServer } from "node:http"
import { Assert, branded, Datetime, Logger, Result, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { createGameConfigurationStub } from "shared/domain/games/GameConfiguration.stub.ts"
import { PlayerColor } from "shared/domain/players/PlayerColor.ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import { TurnStatus } from "shared/domain/turns/TurnStatus.ts"
import { describe, expect, it } from "vitest"
import { AuthService } from "#api/auth/auth.service.ts"
import { ClerkAuthProvider } from "#api/auth/ClerkAuthProvider.ts"
import { AUTH_ID_HEADER } from "#api/auth/TestHeaderAuthProvider.ts"
import { createApiStub } from "#api/createApi.stub.ts"
import { createApi } from "#api/createApi.ts"
import { GetPlayerViewError, GetPlayerViewErrorResponses } from "#api/gameplay/getPlayerView.error.ts"
import { UpdateReadinessError, UpdateReadinessErrorResponses } from "#api/gameplay/updateReadiness.error.ts"
import { ControlledClock } from "#lib/ControlledClock.ts"
import { ApiServer } from "#testing/ApiServer.ts"
import { createIntegrationTestDb } from "#testing/createIntegrationTestDb.ts"
import { readTurnState } from "#testing/readTurnState.ts"
import { TurnsRepository } from "#turn-processing/turns.repository.ts"

describe("gameplay.router", () => {
  it("should reject all gameplay routes when the authenticated player has not joined the game", async () => {
    // Arrange
    await using db = await createIntegrationTestDb()
    using apiServer = new ApiServer(await createApiStub({ db }))
    const creator = await apiServer.createClient({ authenticated: true })
    const nonPlayer = await apiServer.createClient({ authenticated: true })

    const { createdGameId } = await creator.client.games.create.mutate({ configuration: createGameConfigurationStub() })

    // Act & Assert
    const expectedError = { data: { code: "FORBIDDEN" } }
    await expect(readTurnState(nonPlayer, createdGameId)).rejects.toMatchObject(expectedError)
    await expect(nonPlayer.client.gameplay.getPlayerView.query({ gameId: createdGameId })).rejects.toMatchObject(expectedError)
    await expect(nonPlayer.client.gameplay.updateReadiness.mutate({ gameId: createdGameId, turn: 1, isReady: true })).rejects.toMatchObject(
      expectedError,
    )
  })

  describe("turnState", () => {
    it("should send the current turn and readiness when a member connects", async () => {
      // Arrange
      await using db = await createIntegrationTestDb()
      const clock = new ControlledClock()
      using apiServer = new ApiServer(await createApiStub({ db, clock }))
      const player = await apiServer.createClient({ authenticated: true })
      const gameConfiguration = createGameConfigurationStub()
      const { createdGameId } = await player.client.games.create.mutate({ configuration: gameConfiguration })
      await player.client.games.startGame.mutate({ gameId: createdGameId })

      // Act
      const snapshot = await readTurnState(player, createdGameId)

      // Assert
      expect(snapshot).toStrictEqual<typeof snapshot>({
        turn: 1,
        turnStatus: TurnStatus.COLLECTING_ACTIONS,
        turnEndsAt: Datetime.increment({
          date: clock.now(),
          time: Time.create(gameConfiguration.turnIntervalSeconds, UnitOfTime.SECONDS),
        }).toISOString(),
        readinessByPlayerId: { [branded<PlayerId>(player.account.id)]: false },
      })
    })

    it("should reject anonymous subscribers", async () => {
      // Arrange
      await using db = await createIntegrationTestDb()
      using apiServer = new ApiServer(await createApiStub({ db }))
      const anonymous = await apiServer.createClient({ authenticated: false })

      // Act
      const snapshot = readTurnState(anonymous, branded(1))

      // Assert
      await expect(snapshot).rejects.toMatchObject({ data: { code: "UNAUTHORIZED" } })
    })

    it("should reject a subscription to a game that has not started", async () => {
      // Arrange
      await using db = await createIntegrationTestDb()
      using apiServer = new ApiServer(await createApiStub({ db }))
      const player = await apiServer.createClient({ authenticated: true })
      const { createdGameId } = await player.client.games.create.mutate({ configuration: createGameConfigurationStub() })

      // Act
      const snapshot = readTurnState(player, createdGameId)

      // Assert
      await expect(snapshot).rejects.toMatchObject({ data: { code: "NOT_FOUND" } })
    })

    it("should reject a turn-state stream requested over HTTP", async () => {
      // Arrange
      await using db = await createIntegrationTestDb()
      const services = await createApiStub({ db })
      using apiServer = new ApiServer(services)
      const player = await apiServer.createClient({ authenticated: true })
      const { createdGameId } = await player.client.games.create.mutate({ configuration: createGameConfigurationStub() })
      await player.client.games.startGame.mutate({ gameId: createdGameId })

      await using http = createServer(services.api).listen()
      const address = http.address()
      Assert.isDefined(address)
      Assert.isTrue(typeof address !== "string")
      const url = new URL(`http://localhost:${address.port}/trpc/gameplay.turnState`)
      url.searchParams.set("input", JSON.stringify({ gameId: createdGameId }))

      // Act
      const response = await fetch(url, {
        headers: { accept: "text/event-stream", [AUTH_ID_HEADER]: player.account.authId },
        signal: AbortSignal.timeout(5_000),
      })

      // Assert
      const events = await response.text()
      expect(events).toContain("event: serialized-error")
      expect(events).toContain('"code":"METHOD_NOT_SUPPORTED"')
    })

    it("should reject a malformed Clerk session token over WebSocket", async () => {
      // Arrange
      await using db = await createIntegrationTestDb()
      const services = await createApiStub({ db })
      const { logger, accountsRepository } = services
      const authService = new AuthService({ logger, accountsRepository, authProvider: new ClerkAuthProvider({ logger }) })
      const api = await createApi({ ...services, authService })
      using apiServer = new ApiServer({ ...api, accountsRepository })
      const player = await apiServer.createClient({ authenticated: true })

      // Act
      const snapshot = readTurnState(player, branded(1))

      // Assert
      await expect(snapshot).rejects.toMatchObject({ data: { code: "UNAUTHORIZED" } })
    })
  })

  describe("getPlayerView", () => {
    it("should report a missing Turn for a member of an unstarted game", async () => {
      // Arrange
      await using db = await createIntegrationTestDb()
      using apiServer = new ApiServer(await createApiStub({ db }))
      const player = await apiServer.createClient({ authenticated: true })
      const { createdGameId } = await player.client.games.create.mutate({
        configuration: createGameConfigurationStub({ mapGenerationSeed: 1234 }),
      })

      // Act
      const playerView = player.client.gameplay.getPlayerView.query({ gameId: createdGameId })

      // Assert
      await expect(playerView).rejects.toMatchErrorResponse(GetPlayerViewErrorResponses[GetPlayerViewError.TURN_NOT_FOUND])
    })

    it("should get the authenticated player's state for a started game", async () => {
      // Arrange
      await using db = await createIntegrationTestDb()
      const clock = new ControlledClock()
      using apiServer = new ApiServer(await createApiStub({ db, clock }))
      const player = await apiServer.createClient({ authenticated: true })

      const gameConfiguration = createGameConfigurationStub()
      const { createdGameId } = await player.client.games.create.mutate({ configuration: gameConfiguration })

      await player.client.games.startGame.mutate({ gameId: createdGameId })

      // Act
      const getPlayerViewResult = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      const repeatedGetPlayerViewResult = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })

      // Assert
      expect(getPlayerViewResult).toStrictEqual<typeof getPlayerViewResult>({
        gameId: createdGameId,
        player: { id: branded(player.account.id), color: PlayerColor.TURQUOISE },
        opponents: {},
        galaxy: expect.any(Object), // INTENT: Verified by the snapshot test
        turn: 1,
      })
      expect(repeatedGetPlayerViewResult).toStrictEqual(getPlayerViewResult)
    })

    it("should expose the current player and every opponent with their colors", async () => {
      // Arrange
      await using db = await createIntegrationTestDb()
      using apiServer = new ApiServer(await createApiStub({ db }))
      const creator = await apiServer.createClient({ authenticated: true })
      const firstOpponent = await apiServer.createClient({ authenticated: true })
      const secondOpponent = await apiServer.createClient({ authenticated: true })

      const { createdGameId } = await creator.client.games.create.mutate({
        configuration: createGameConfigurationStub({ nbSeats: 3 }),
      })
      await firstOpponent.client.games.join.mutate({ gameId: createdGameId })
      await secondOpponent.client.games.join.mutate({ gameId: createdGameId })

      await creator.client.games.startGame.mutate({ gameId: createdGameId })

      // Act
      const playerView = await creator.client.gameplay.getPlayerView.query({ gameId: createdGameId })

      // Assert
      expect(playerView.player).toStrictEqual({ id: creator.account.id, color: PlayerColor.TURQUOISE })
      expect(playerView.opponents).toStrictEqual({
        [firstOpponent.account.id]: { id: firstOpponent.account.id, color: PlayerColor.PINK },
        [secondOpponent.account.id]: { id: secondOpponent.account.id, color: PlayerColor.YELLOW },
      })
    })

    it("should reject invalid game ids", async () => {
      // Arrange
      await using db = await createIntegrationTestDb()
      using apiServer = new ApiServer(await createApiStub({ db }))
      const player = await apiServer.createClient({ authenticated: true })

      // Act
      // @ts-expect-error Testing runtime input parsing with an invalid game id
      const getPlayerView = player.client.gameplay.getPlayerView.query({ gameId: "not-a-game-id" })

      // Assert
      await expect(getPlayerView).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
    })

    it("should reject anonymous game state reads", async () => {
      // Arrange
      await using db = await createIntegrationTestDb()
      using apiServer = new ApiServer(await createApiStub({ db }))
      const anonymous = await apiServer.createClient({ authenticated: false })

      // Act
      const getPlayerView = anonymous.client.gameplay.getPlayerView.query({ gameId: 1 })

      // Assert
      await expect(getPlayerView).rejects.toMatchObject({ data: { code: "UNAUTHORIZED" } })
    })
  })

  // INTENT: This test suite is often failing, but only in the CI. Not sure if it is hanging or just taking longer. If we get timeouts on a 20s budget, this is definitely hanging and there's an issue running on the CI that we should address.
  describe("updateReadiness", { timeout: 20_000 }, () => {
    it.each([true, false])("should set the player readiness to %s", async (isReady) => {
      // Arrange
      await using db = await createIntegrationTestDb()
      using apiServer = new ApiServer(await createApiStub({ db }))
      const creator = await apiServer.createClient({ authenticated: true })
      const player = await apiServer.createClient({ authenticated: true })

      const { createdGameId } = await creator.client.games.create.mutate({
        configuration: createGameConfigurationStub({ mapGenerationSeed: 1234 }),
      })
      await player.client.games.join.mutate({ gameId: createdGameId })

      await creator.client.games.startGame.mutate({ gameId: createdGameId })
      // Act
      await creator.client.gameplay.updateReadiness.mutate({ gameId: createdGameId, turn: 1, isReady: !isReady })
      await creator.client.gameplay.updateReadiness.mutate({ gameId: createdGameId, turn: 1, isReady })

      // Assert
      const snapshot = await readTurnState(creator, createdGameId)
      expect(snapshot.readinessByPlayerId).toStrictEqual({
        [creator.account.id]: isReady,
        [player.account.id]: false,
      })
    })

    it("should close the turn and submit for processing when all players are ready", async () => {
      // Arrange
      await using db = await createIntegrationTestDb()
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
      const initialSnapshot = await readTurnState(creator, createdGameId)

      // Act
      await player.client.gameplay.updateReadiness.mutate({ gameId: createdGameId, turn: 1, isReady: true })
      const onePlayerReady = await readTurnState(creator, createdGameId)

      await creator.client.gameplay.updateReadiness.mutate({ gameId: createdGameId, turn: 1, isReady: true })
      const allPlayersReady = await readTurnState(creator, createdGameId)

      // Assert
      expect(onePlayerReady).toStrictEqual<typeof onePlayerReady>({
        ...initialSnapshot,
        readinessByPlayerId: { [creator.account.id]: false, [player.account.id]: true },
      })
      expect(allPlayersReady).toStrictEqual<typeof allPlayersReady>({
        ...initialSnapshot,
        turnStatus: TurnStatus.AWAITING_PROCESSING,
        readinessByPlayerId: { [creator.account.id]: true, [player.account.id]: true },
      })

      const turnForProcessing = await apiServices.createTransaction(
        async (tx) => await turnsRepository.getNextTurnForProcessing({ since: clock.now() }, tx),
      )
      expect(turnForProcessing).toStrictEqual<typeof turnForProcessing>(Result.Success(branded({ gameId: createdGameId, turn: 1 })))
    })

    it("should reject readiness for the wrong turn", async () => {
      // Arrange
      await using db = await createIntegrationTestDb()
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
      await expect(updateReadiness).rejects.toMatchErrorResponse(UpdateReadinessErrorResponses[UpdateReadinessError.TURN_NOT_OPEN])
      const playerView = await creator.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      expect(playerView).toStrictEqual<typeof playerView>(initialPlayerView)
    })

    it("should reject readiness past the deadline", async () => {
      // Arrange
      await using db = await createIntegrationTestDb()
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
      await expect(updateReadiness).rejects.toMatchErrorResponse(UpdateReadinessErrorResponses[UpdateReadinessError.TURN_NOT_OPEN])
      const playerView = await creator.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      expect(playerView).toStrictEqual<typeof playerView>(initialPlayerView)
    })

    it("should reject readiness for players not in the game", async () => {
      // Arrange
      await using db = await createIntegrationTestDb()
      const clock = new ControlledClock()
      using apiServer = new ApiServer(await createApiStub({ db, clock }))
      const creator = await apiServer.createClient({ authenticated: true })
      const player = await apiServer.createClient({ authenticated: true })

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
