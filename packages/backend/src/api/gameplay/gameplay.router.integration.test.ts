import { branded, Datetime, Logger, Result, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { createGameConfigurationStub } from "shared/domain/games/GameConfiguration.stub.ts"
import { PlayerColor } from "shared/domain/players/PlayerColor.ts"
import { TurnStatus } from "shared/domain/turns/TurnStatus.ts"
import { describe, expect, it } from "vitest"
import { createApiStub } from "#api/createApi.stub.ts"
import { GetPlayerViewError, GetPlayerViewErrorResponses } from "#api/gameplay/getPlayerView.error.ts"
import { TurnStateError, TurnStateErrorResponses } from "#api/gameplay/turnState.error.ts"
import { UpdateReadinessError, UpdateReadinessErrorResponses } from "#api/gameplay/updateReadiness.error.ts"
import type { TurnState } from "#api/types.ts"
import { ControlledClock } from "#lib/ControlledClock.ts"
import { ApiServer } from "#testing/ApiServer.ts"
import { createIntegrationTestDb } from "#testing/createIntegrationTestDb.ts"
import { readTurnState } from "#testing/readTurnState.ts"
import { TurnsRepository } from "#turn-processing/turns.repository.ts"

describe("gameplay.router", () => {
  it("should reject all gameplay routes when the authenticated player has not joined the game", async () => {
    // Arrange
    await using db = await createIntegrationTestDb()
    await using apiServer = await ApiServer.create(createApiStub({ db }))
    const creator = await apiServer.createClient({ authenticated: true })
    const nonPlayer = await apiServer.createClient({ authenticated: true })

    const { createdGameId } = await creator.client.games.create.mutate({ configuration: createGameConfigurationStub() })

    // Act & Assert
    const expectedError = { data: { code: "FORBIDDEN" } }
    await expect(nonPlayer.client.gameplay.getPlayerView.query({ gameId: createdGameId })).rejects.toMatchObject(expectedError)
    await expect(readTurnState(nonPlayer, createdGameId)).rejects.toMatchObject(expectedError)
    await expect(nonPlayer.client.gameplay.updateReadiness.mutate({ gameId: createdGameId, turn: 1, isReady: true })).rejects.toMatchObject(
      expectedError,
    )
  })

  describe("getPlayerView", () => {
    it("should report a missing Turn for a member of an unstarted game", async () => {
      // Arrange
      await using db = await createIntegrationTestDb()
      await using apiServer = await ApiServer.create(createApiStub({ db }))
      const player = await apiServer.createClient({ authenticated: true })
      const { createdGameId } = await player.client.games.create.mutate({
        configuration: createGameConfigurationStub({ mapGenerationSeed: 1234 }),
      })

      // Act
      const playerView = player.client.gameplay.getPlayerView.query({ gameId: createdGameId })

      // Assert
      await expect(playerView).rejects.toMatchErrorResponse(GetPlayerViewErrorResponses[GetPlayerViewError.TURN_NOT_FOUND])
      await expect(readTurnState(player, createdGameId)).rejects.toMatchErrorResponse(
        TurnStateErrorResponses[TurnStateError.TURN_NOT_FOUND],
      )
    })

    it("should get the authenticated player's state for a started game", async () => {
      // Arrange
      await using db = await createIntegrationTestDb()
      const clock = new ControlledClock()
      await using apiServer = await ApiServer.create(createApiStub({ db, clock }))
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
      await using apiServer = await ApiServer.create(createApiStub({ db }))
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
      await using apiServer = await ApiServer.create(createApiStub({ db }))
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
      await using apiServer = await ApiServer.create(createApiStub({ db }))
      const anonymous = await apiServer.createClient({ authenticated: false })

      // Act
      const getPlayerView = anonymous.client.gameplay.getPlayerView.query({ gameId: 1 })

      // Assert
      await expect(getPlayerView).rejects.toMatchObject({ data: { code: "UNAUTHORIZED" } })
    })
  })

  it("should send the same initial turn state to every player", async () => {
    // Arrange
    await using db = await createIntegrationTestDb()
    const clock = new ControlledClock()
    await using apiServer = await ApiServer.create(createApiStub({ db, clock }))
    const creator = await apiServer.createClient({ authenticated: true })
    const opponent = await apiServer.createClient({ authenticated: true })
    const configuration = createGameConfigurationStub({ nbSeats: 2 })
    const { createdGameId } = await creator.client.games.create.mutate({ configuration })
    await opponent.client.games.join.mutate({ gameId: createdGameId })
    await creator.client.games.startGame.mutate({ gameId: createdGameId })

    // Act
    const [creatorSnapshot, opponentSnapshot] = await Promise.all([
      readTurnState(creator, createdGameId),
      readTurnState(opponent, createdGameId),
    ])

    // Assert
    expect(creatorSnapshot).toStrictEqual({
      turn: 1,
      turnStatus: TurnStatus.COLLECTING_ACTIONS,
      turnEndsAt: Datetime.increment({
        date: clock.now(),
        time: Time.create(configuration.turnIntervalSeconds, UnitOfTime.SECONDS),
      }).toISOString(),
      readinessByPlayerId: { [creator.account.id]: false, [opponent.account.id]: false },
    })
    expect(opponentSnapshot).toStrictEqual(creatorSnapshot)
  })

  it("should send readiness changes to an open turn state subscription", async () => {
    // Arrange
    await using db = await createIntegrationTestDb()
    await using apiServer = await ApiServer.create(createApiStub({ db }))
    const creator = await apiServer.createClient({ authenticated: true })
    const opponent = await apiServer.createClient({ authenticated: true })
    const configuration = createGameConfigurationStub({ nbSeats: 2 })
    const { createdGameId: gameId } = await creator.client.games.create.mutate({ configuration })
    await opponent.client.games.join.mutate({ gameId })
    await creator.client.games.startGame.mutate({ gameId })

    let latestSnapshot: TurnState | undefined
    const subscription = creator.client.gameplay.turnState.subscribe(
      { gameId },
      {
        onData: (snapshot) => {
          latestSnapshot = snapshot
        },
      },
    )
    using _subscriptionCleanup = {
      [Symbol.dispose](): void {
        subscription.unsubscribe()
      },
    }
    await expect
      .poll(() => latestSnapshot?.readinessByPlayerId)
      .toStrictEqual({
        [creator.account.id]: false,
        [opponent.account.id]: false,
      })

    // Act
    await opponent.client.gameplay.updateReadiness.mutate({ gameId, turn: 1, isReady: true })

    // Assert
    await expect
      .poll(() => latestSnapshot?.readinessByPlayerId)
      .toStrictEqual({
        [creator.account.id]: false,
        [opponent.account.id]: true,
      })
  })

  // INTENT: This test suite is often failing, but only in the CI. Not sure if it is hanging or just taking longer. If we get timeouts on a 20s budget, this is definitely hanging and there's an issue running on the CI that we should address.
  describe("updateReadiness", { timeout: 20_000 }, () => {
    it.each([true, false])("should set the player readiness to %s", async (isReady) => {
      // Arrange
      await using db = await createIntegrationTestDb()
      await using apiServer = await ApiServer.create(createApiStub({ db }))
      const creator = await apiServer.createClient({ authenticated: true })
      const player = await apiServer.createClient({ authenticated: true })

      const { createdGameId } = await creator.client.games.create.mutate({
        configuration: createGameConfigurationStub({ mapGenerationSeed: 1234 }),
      })
      await player.client.games.join.mutate({ gameId: createdGameId })

      await creator.client.games.startGame.mutate({ gameId: createdGameId })
      const initialTurnState = await readTurnState(creator, createdGameId)

      // Act
      await creator.client.gameplay.updateReadiness.mutate({ gameId: createdGameId, turn: 1, isReady: !isReady })
      await creator.client.gameplay.updateReadiness.mutate({ gameId: createdGameId, turn: 1, isReady })

      // Assert
      expect(await readTurnState(creator, createdGameId)).toStrictEqual({
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

      const apiServices = createApiStub({ db, clock })
      await using apiServer = await ApiServer.create(apiServices)
      const creator = await apiServer.createClient({ authenticated: true })
      const player = await apiServer.createClient({ authenticated: true })

      const { createdGameId } = await creator.client.games.create.mutate({
        configuration: createGameConfigurationStub({ mapGenerationSeed: 1234 }),
      })
      await player.client.games.join.mutate({ gameId: createdGameId })

      await creator.client.games.startGame.mutate({ gameId: createdGameId })
      const initialTurnState = await readTurnState(creator, createdGameId)

      // Act
      await player.client.gameplay.updateReadiness.mutate({ gameId: createdGameId, turn: 1, isReady: true })
      const turnStateWithOnePlayerReady = await readTurnState(creator, createdGameId)

      await creator.client.gameplay.updateReadiness.mutate({ gameId: createdGameId, turn: 1, isReady: true })
      const turnStateWithAllPlayersReady = await readTurnState(creator, createdGameId)

      // Assert
      expect(turnStateWithOnePlayerReady).toStrictEqual({
        ...initialTurnState,
        readinessByPlayerId: { [creator.account.id]: false, [player.account.id]: true },
      })
      expect(turnStateWithAllPlayersReady).toStrictEqual({
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
      await using apiServer = await ApiServer.create(createApiStub({ db }))
      const creator = await apiServer.createClient({ authenticated: true })

      const { createdGameId } = await creator.client.games.create.mutate({
        configuration: createGameConfigurationStub({ mapGenerationSeed: 1234 }),
      })

      await creator.client.games.startGame.mutate({ gameId: createdGameId })
      const initialTurnState = await readTurnState(creator, createdGameId)

      // Act
      const updateReadiness = creator.client.gameplay.updateReadiness.mutate({ gameId: createdGameId, turn: 0, isReady: true })

      // Assert
      await expect(updateReadiness).rejects.toMatchErrorResponse(UpdateReadinessErrorResponses[UpdateReadinessError.TURN_NOT_OPEN])
      expect(await readTurnState(creator, createdGameId)).toStrictEqual(initialTurnState)
    })

    it("should reject readiness past the deadline", async () => {
      // Arrange
      await using db = await createIntegrationTestDb()
      const clock = new ControlledClock()
      await using apiServer = await ApiServer.create(createApiStub({ db, clock }))
      const creator = await apiServer.createClient({ authenticated: true })

      const turnInterval = Time.create(10, UnitOfTime.SECONDS)
      const { createdGameId } = await creator.client.games.create.mutate({
        configuration: createGameConfigurationStub({
          mapGenerationSeed: 1234,
          turnIntervalSeconds: Time.in(turnInterval, UnitOfTime.SECONDS),
        }),
      })

      await creator.client.games.startGame.mutate({ gameId: createdGameId })
      const initialTurnState = await readTurnState(creator, createdGameId)

      // Act
      clock.increment({ time: turnInterval })
      const updateReadiness = creator.client.gameplay.updateReadiness.mutate({ gameId: createdGameId, turn: 1, isReady: true })

      // Assert
      await expect(updateReadiness).rejects.toMatchErrorResponse(UpdateReadinessErrorResponses[UpdateReadinessError.TURN_NOT_OPEN])
      expect(await readTurnState(creator, createdGameId)).toStrictEqual(initialTurnState)
    })

    it("should reject readiness for players not in the game", async () => {
      // Arrange
      await using db = await createIntegrationTestDb()
      const clock = new ControlledClock()
      await using apiServer = await ApiServer.create(createApiStub({ db, clock }))
      const creator = await apiServer.createClient({ authenticated: true })
      const player = await apiServer.createClient({ authenticated: true })

      const { createdGameId } = await creator.client.games.create.mutate({
        configuration: createGameConfigurationStub({ mapGenerationSeed: 1234 }),
      })

      await creator.client.games.startGame.mutate({ gameId: createdGameId })
      const initialTurnState = await readTurnState(creator, createdGameId)

      // Act
      const updateReadiness = player.client.gameplay.updateReadiness.mutate({ gameId: createdGameId, turn: 1, isReady: true })

      // Assert
      await expect(updateReadiness).rejects.toMatchObject({ data: { code: "FORBIDDEN" } })
      expect(await readTurnState(creator, createdGameId)).toStrictEqual(initialTurnState)
    })
  })
})
