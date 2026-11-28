import { branded, Datetime, Logger, Result, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { createGameConfigurationStub } from "shared/domain/games/GameConfiguration.stub.ts"
import { PlayerColor } from "shared/domain/players/PlayerColor.ts"
import { TurnStatus } from "shared/domain/turns/TurnStatus.ts"
import { describe, expect, it } from "vitest"
import { createApiStub } from "#api/createApi.stub.ts"
import { GetPlayerViewError, GetPlayerViewErrorResponses } from "#api/gameplay/getPlayerView.error.ts"
import { UpdateReadinessError, UpdateReadinessErrorResponses } from "#api/gameplay/updateReadiness.error.ts"
import { ControlledClock } from "#lib/ControlledClock.ts"
import type { NotificationHandlers, NotificationListener } from "#lib/db/PostgresNotificationListener.ts"
import { ApiServer } from "#testing/ApiServer.ts"
import { createIntegrationTestDb } from "#testing/createIntegrationTestDb.ts"
import { readTurnState, subscribeToTurnState } from "#testing/readTurnState.ts"
import { TurnsRepository } from "#turn-processing/turns.repository.ts"
import { GetTurnStateError, GetTurnStateErrorResponses } from "./getTurnState.error.ts"

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
    await expect(readTurnState(nonPlayer.client, createdGameId)).rejects.toMatchObject(expectedError)
    await expect(nonPlayer.client.gameplay.getPlayerView.query({ gameId: createdGameId })).rejects.toMatchObject(expectedError)
    await expect(nonPlayer.client.gameplay.updateReadiness.mutate({ gameId: createdGameId, turn: 1, isReady: true })).rejects.toMatchObject(
      expectedError,
    )
  })

  it("should refresh subscribers after notifications resume with a change missed during the gap", async () => {
    // Arrange
    const registeredNotificationHandlers = Promise.withResolvers<NotificationHandlers>()
    const notificationListener: NotificationListener = {
      listen: (_channel, handlers) => {
        registeredNotificationHandlers.resolve(handlers)
      },
    }

    await using db = await createIntegrationTestDb()
    using apiServer = new ApiServer(await createApiStub({ db, notificationListener }))
    const alice = await apiServer.createClient({ authenticated: true })
    const bob = await apiServer.createClient({ authenticated: true })

    const { createdGameId } = await alice.client.games.create.mutate({
      configuration: createGameConfigurationStub({ mapGenerationSeed: 1234 }),
    })
    await bob.client.games.join.mutate({ gameId: createdGameId })
    await alice.client.games.startGame.mutate({ gameId: createdGameId })

    const notificationHandlers = await registeredNotificationHandlers.promise
    using aliceStream = subscribeToTurnState(alice.client, createdGameId)
    using bobStream = subscribeToTurnState(bob.client, createdGameId)
    notificationHandlers.onReady()
    const [aliceInitialTurnState, bobInitialTurnState] = await Promise.all([aliceStream.next(), bobStream.next()])

    // Act
    await alice.client.gameplay.updateReadiness.mutate({ gameId: createdGameId, turn: 1, isReady: true })
    notificationHandlers.onReady()

    // Assert
    const expectedTurnState = {
      ...aliceInitialTurnState,
      readinessByPlayerId: { [alice.account.id]: true, [bob.account.id]: false },
    }
    expect(bobInitialTurnState).toStrictEqual<typeof aliceInitialTurnState>(aliceInitialTurnState)
    await expect.poll(aliceStream.next).toStrictEqual<typeof aliceInitialTurnState>(expectedTurnState)
    await expect.poll(bobStream.next).toStrictEqual<typeof aliceInitialTurnState>(expectedTurnState)
  })

  describe("getPlayerView", () => {
    it("should meet PVR-0002 When a planet surface is read in a fresh session or after server restart, each building retains its identity, type, planet and occupied hex.", async () => {
      // Arrange
      await using db = await createIntegrationTestDb()
      using firstServer = new ApiServer(await createApiStub({ db }))
      const first = await firstServer.createClient({ authenticated: true })
      using secondServer = new ApiServer(await createApiStub({ db }))
      const fresh = await secondServer.createClient({ authenticated: true })
      const { createdGameId: gameId } = await first.client.games.create.mutate({
        configuration: createGameConfigurationStub({ mapGenerationSeed: 1234 }),
      })
      await fresh.client.games.join.mutate({ gameId })
      await first.client.games.startGame.mutate({ gameId })
      const before = await first.client.gameplay.getPlayerView.query({ gameId })

      // Act
      const after = await fresh.client.gameplay.getPlayerView.query({ gameId })

      // Assert
      expect(before.buildings).toHaveLength(4)
      expect(before.buildings).toStrictEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: expect.any(String), type: "COMMAND_CENTER", site: 0, planetId: expect.any(String) }),
        ]),
      )
      expect(after.buildings.toSorted((a, b) => a.id.localeCompare(b.id))).toStrictEqual(
        before.buildings.toSorted((a, b) => a.id.localeCompare(b.id)),
      )
    })

    it("should meet PVR-0001 When a player reads a saved planet, the API returns its stored metal production and remaining deposit and omits the former metal, fertility, fuel, energy and maximum population fields.", async () => {
      // Arrange
      await using db = await createIntegrationTestDb()
      using apiServer = new ApiServer(await createApiStub({ db }))
      const player = await apiServer.createClient({ authenticated: true })
      const { createdGameId: gameId } = await player.client.games.create.mutate({
        configuration: createGameConfigurationStub({ mapGenerationSeed: 1234 }),
      })
      await player.client.games.startGame.mutate({ gameId })

      // Act
      const view = await player.client.gameplay.getPlayerView.query({ gameId })
      const reopened = await player.client.gameplay.getPlayerView.query({ gameId })

      // Assert
      const sample = view.galaxy.systems.flatMap((system) => system.planets).find((planet) => planet.coordinates === "63:50:40")
      expect(sample).toStrictEqual({
        area: 4,
        biome: "METALLIC",
        coordinates: "63:50:40",
        id: "37c2b7b7-e1b1-584c-9043-aaab03ac3808",
        metalProduction: 4,
        remainingMetalDeposit: 19,
        name: "planet 272683",
        ownerPlayerId: null,
        size: "MEDIUM",
        x: 30.754045402421188,
        y: 65.12758196335155,
      })
      expect(reopened.galaxy.systems.flatMap((system) => system.planets).find((planet) => planet.coordinates === "63:50:40")).toStrictEqual(
        sample,
      )
    })

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
      await expect(readTurnState(player.client, createdGameId)).rejects.toMatchErrorResponse(
        GetTurnStateErrorResponses[GetTurnStateError.TURN_NOT_FOUND],
      )
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
      const turnState = await readTurnState(player.client, createdGameId)

      // Assert
      expect(getPlayerViewResult).toStrictEqual<typeof getPlayerViewResult>({
        gameId: createdGameId,
        player: { id: branded(player.account.id), color: PlayerColor.TURQUOISE, creditBalance: 100 },
        opponents: {},
        constructionOrders: [],
        buildings: expect.arrayContaining([
          expect.objectContaining({ type: "COMMAND_CENTER", site: 0 }),
          expect.objectContaining({ type: "TRADE_CENTER", site: 1 }),
        ]),
        galaxy: expect.any(Object), // INTENT: Verified by the snapshot test
        turn: 1,
      })
      expect(turnState).toStrictEqual<typeof turnState>({
        turn: 1,
        readinessByPlayerId: { [player.account.id]: false },
        turnStatus: TurnStatus.COLLECTING_ACTIONS,
        turnEndsAt: Datetime.increment({
          date: clock.now(),
          time: Time.create(gameConfiguration.turnIntervalSeconds, UnitOfTime.SECONDS),
        }).toISOString(),
      })
    })

    it("should meet PVR-0003 When a participant reads their player view, it returns that participant’s settled credit balance for the current game and keeps other participants’ credit balances private.", async () => {
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
      expect(playerView.player).toStrictEqual({ id: creator.account.id, color: PlayerColor.TURQUOISE, creditBalance: 100 })
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
      const initialTurnState = await readTurnState(creator.client, createdGameId)

      // Act
      await creator.client.gameplay.updateReadiness.mutate({ gameId: createdGameId, turn: 1, isReady: !isReady })
      await creator.client.gameplay.updateReadiness.mutate({ gameId: createdGameId, turn: 1, isReady })

      // Assert
      const turnState = await readTurnState(creator.client, createdGameId)
      expect(turnState).toStrictEqual<typeof turnState>({
        ...initialTurnState,
        readinessByPlayerId: { [creator.account.id]: isReady, [player.account.id]: false },
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
      using stream = subscribeToTurnState(creator.client, createdGameId)
      const initialTurnState = await stream.next()

      // Act
      await player.client.gameplay.updateReadiness.mutate({ gameId: createdGameId, turn: 1, isReady: true })
      const turnStateWithOnePlayerReady = await stream.next()

      await creator.client.gameplay.updateReadiness.mutate({ gameId: createdGameId, turn: 1, isReady: true })
      const turnStateWithAllPlayersReady = await stream.next()

      // Assert
      expect(turnStateWithOnePlayerReady).toStrictEqual<typeof initialTurnState>({
        ...initialTurnState,
        readinessByPlayerId: { [creator.account.id]: false, [player.account.id]: true },
      })
      expect(turnStateWithAllPlayersReady).toStrictEqual<typeof initialTurnState>({
        ...initialTurnState,
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
      const initialTurnState = await readTurnState(creator.client, createdGameId)

      // Act
      const updateReadiness = creator.client.gameplay.updateReadiness.mutate({ gameId: createdGameId, turn: 0, isReady: true })

      // Assert
      await expect(updateReadiness).rejects.toMatchErrorResponse(UpdateReadinessErrorResponses[UpdateReadinessError.TURN_NOT_OPEN])
      const turnState = await readTurnState(creator.client, createdGameId)
      expect(turnState).toStrictEqual<typeof turnState>(initialTurnState)
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
      const initialTurnState = await readTurnState(creator.client, createdGameId)

      // Act
      clock.increment({ time: turnInterval })
      const updateReadiness = creator.client.gameplay.updateReadiness.mutate({ gameId: createdGameId, turn: 1, isReady: true })

      // Assert
      await expect(updateReadiness).rejects.toMatchErrorResponse(UpdateReadinessErrorResponses[UpdateReadinessError.TURN_NOT_OPEN])
      const turnState = await readTurnState(creator.client, createdGameId)
      expect(turnState).toStrictEqual<typeof turnState>(initialTurnState)
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
      const initialTurnState = await readTurnState(creator.client, createdGameId)

      // Act
      const updateReadiness = player.client.gameplay.updateReadiness.mutate({ gameId: createdGameId, turn: 1, isReady: true })

      // Assert
      await expect(updateReadiness).rejects.toMatchObject({ data: { code: "FORBIDDEN" } })
      const turnState = await readTurnState(creator.client, createdGameId)
      expect(turnState).toStrictEqual<typeof turnState>(initialTurnState)
    })
  })
})
