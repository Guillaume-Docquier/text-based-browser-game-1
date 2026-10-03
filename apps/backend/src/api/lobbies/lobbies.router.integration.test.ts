import { branded } from "@guillaume-docquier/tools-ts"
import { GameStatus } from "shared/domain/game/GameStatus.ts"
import { PlayerColor } from "shared/domain/players/PlayerColor.ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import { TestRuleset } from "shared/testing/test-ruleset/TestRuleset.ts"
import { describe, expect, it } from "vitest"
import { createApiStub } from "#api/createApi.stub.ts"
import { createLobbyConfigurationDtoStub } from "#api/lobbies/CreateLobbyConfigurationDto.stub.ts"
import { type LobbyPlayerDto, MAX_NB_SEATS, type RulesetSummaryDto } from "#api/lobbies/lobbies.controller.ts"
import { UInt32 } from "#lib/UInt32.ts"
import { ApiServer } from "#tests/ApiServer.ts"

const TEST_RULESET_SUMMARY: RulesetSummaryDto = {
  id: TestRuleset.id,
  name: TestRuleset.name,
  isDefault: TestRuleset.isDefault,
}

describe("lobbies.router", () => {
  describe("getCreationSettings", () => {
    it("should return backend-driven defaults and limits", async () => {
      // Arrange
      await using apiServer = new ApiServer(await createApiStub())
      const player = await apiServer.createClient({ authenticated: true })

      // Act
      const creationSettings = await player.client.lobbies.getCreationSettings.query()

      // Assert
      expect(creationSettings).toStrictEqual<typeof creationSettings>({
        maxNbSeats: MAX_NB_SEATS,
        rulesets: [TEST_RULESET_SUMMARY],
      })
    })
  })

  describe("create", () => {
    it.each([0, UInt32.max])("should accept the UInt32 seed %i", async (mapGenerationSeed) => {
      // Arrange
      await using apiServer = new ApiServer(await createApiStub())
      const creator = await apiServer.createClient({ authenticated: true })

      // Act
      const createLobbyResult = await creator.client.lobbies.create.mutate({
        configuration: createLobbyConfigurationDtoStub({ mapGenerationSeed }),
      })

      // Assert
      expect(createLobbyResult).toStrictEqual<typeof createLobbyResult>({ createdGameId: expect.any(Number) })
    })

    it.each([-1, UInt32.max + 1, 1.5])("should reject the invalid seed %i", async (mapGenerationSeed) => {
      // Arrange
      await using apiServer = new ApiServer(await createApiStub())
      const creator = await apiServer.createClient({ authenticated: true })

      // Act
      const createLobby = creator.client.lobbies.create.mutate({ configuration: createLobbyConfigurationDtoStub({ mapGenerationSeed }) })

      // Assert
      await expect(createLobby).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
    })

    it("should reject an unknown Ruleset", async () => {
      // Arrange
      await using apiServer = new ApiServer(await createApiStub())
      const creator = await apiServer.createClient({ authenticated: true })

      // Act
      const createLobby = creator.client.lobbies.create.mutate({
        configuration: createLobbyConfigurationDtoStub({ rulesetId: "unknown" }),
      })

      // Assert
      await expect(createLobby).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
    })

    it("should create a game for the authenticated player", async () => {
      // Arrange
      await using apiServer = new ApiServer(await createApiStub())
      const creator = await apiServer.createClient({ authenticated: true })

      const newGameSettings = createLobbyConfigurationDtoStub()

      // Act
      const createLobbyResult = await creator.client.lobbies.create.mutate({ configuration: newGameSettings })

      // Assert
      expect(createLobbyResult).toStrictEqual<typeof createLobbyResult>({ createdGameId: expect.any(Number) })

      const createdGame = await creator.client.lobbies.getById.query({ gameId: createLobbyResult.createdGameId })
      const expectedCreator: LobbyPlayerDto = {
        id: branded(creator.account.id),
        alias: creator.account.alias,
        color: PlayerColor.TURQUOISE,
      }

      expect(createdGame).toStrictEqual<typeof createdGame>({
        id: createLobbyResult.createdGameId,
        createdAt: expect.any(String),
        configuration: {
          name: newGameSettings.name,
          nbSeats: newGameSettings.nbSeats,
          turnIntervalSeconds: newGameSettings.turnIntervalSeconds,
          ruleset: TEST_RULESET_SUMMARY,
        },
        endedAt: null,
        startedAt: null,
        winnerAccountId: null,
        creator: expectedCreator,
        players: [expectedCreator],
        status: GameStatus.WAITING_FOR_PLAYERS,
        canJoin: false, // because already joined
        canLeave: false, // because creator
        canStart: true, // because creator
        canOpen: false, // because not started
      })
    })

    it("should create a one-seat game ready to start", async () => {
      // Arrange
      await using apiServer = new ApiServer(await createApiStub())
      const creator = await apiServer.createClient({ authenticated: true })

      // Act
      const { createdGameId } = await creator.client.lobbies.create.mutate({
        configuration: createLobbyConfigurationDtoStub({ nbSeats: 1 }),
      })

      // Assert
      const lobby = await creator.client.lobbies.getById.query({ gameId: createdGameId })
      expect(lobby.status).toBe(GameStatus.READY_TO_START)
    })

    it("should create a game with MAX_NB_SEATS seats", async () => {
      // Arrange
      await using apiServer = new ApiServer(await createApiStub())
      const creator = await apiServer.createClient({ authenticated: true })

      // Act
      const { createdGameId } = await creator.client.lobbies.create.mutate({
        configuration: createLobbyConfigurationDtoStub({ nbSeats: MAX_NB_SEATS }),
      })

      // Assert
      const lobby = await creator.client.lobbies.getById.query({ gameId: createdGameId })
      expect(lobby.configuration.nbSeats).toBe(MAX_NB_SEATS)
    })

    it("should reject a game with MAX_NB_SEATS + 1 seats", async () => {
      // Arrange
      await using apiServer = new ApiServer(await createApiStub())
      const creator = await apiServer.createClient({ authenticated: true })

      // Act
      const createLobby = creator.client.lobbies.create.mutate({
        configuration: createLobbyConfigurationDtoStub({ nbSeats: MAX_NB_SEATS + 1 }),
      })

      // Assert
      await expect(createLobby).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
    })

    it("should reject anonymous game creation", async () => {
      // Arrange
      await using apiServer = new ApiServer(await createApiStub())
      const anonymous = await apiServer.createClient({ authenticated: false })

      // Act
      const createLobby = anonymous.client.lobbies.create.mutate({
        configuration: createLobbyConfigurationDtoStub(),
      })

      // Assert
      await expect(createLobby).rejects.toMatchObject({ data: { code: "UNAUTHORIZED" } })
    })
  })

  describe("getById", () => {
    it("should get a lobby by id when authenticated", async () => {
      // Arrange
      await using apiServer = new ApiServer(await createApiStub())
      const creator = await apiServer.createClient({ authenticated: true })
      const viewer = await apiServer.createClient({ authenticated: true })

      const newGameSettings = createLobbyConfigurationDtoStub()
      const { createdGameId } = await creator.client.lobbies.create.mutate({ configuration: newGameSettings })

      // Act
      const lobby = await viewer.client.lobbies.getById.query({ gameId: createdGameId })

      // Assert
      const expectedCreator: LobbyPlayerDto = {
        id: branded(creator.account.id),
        alias: creator.account.alias,
        color: PlayerColor.TURQUOISE,
      }
      expect(lobby).toStrictEqual<typeof lobby>({
        id: createdGameId,
        createdAt: expect.any(String),
        endedAt: null,
        winnerAccountId: null,
        configuration: {
          name: newGameSettings.name,
          nbSeats: newGameSettings.nbSeats,
          turnIntervalSeconds: newGameSettings.turnIntervalSeconds,
          ruleset: TEST_RULESET_SUMMARY,
        },
        startedAt: null,
        creator: expectedCreator,
        players: [expectedCreator],
        status: GameStatus.WAITING_FOR_PLAYERS,
        canJoin: true,
        canLeave: false,
        canStart: false,
        canOpen: false,
      })
    })

    it("should get a lobby by id anonymously", async () => {
      // Arrange
      await using apiServer = new ApiServer(await createApiStub())
      const creator = await apiServer.createClient({ authenticated: true })
      const anonymous = await apiServer.createClient({ authenticated: false })

      const newGameSettings = createLobbyConfigurationDtoStub()
      const { createdGameId } = await creator.client.lobbies.create.mutate({ configuration: newGameSettings })

      // Act
      const lobby = await anonymous.client.lobbies.getById.query({ gameId: createdGameId })

      // Assert
      const expectedCreator: LobbyPlayerDto = {
        id: branded(creator.account.id),
        alias: creator.account.alias,
        color: PlayerColor.TURQUOISE,
      }
      expect(lobby).toStrictEqual<typeof lobby>({
        id: createdGameId,
        createdAt: expect.any(String),
        endedAt: null,
        winnerAccountId: null,
        configuration: {
          name: newGameSettings.name,
          nbSeats: newGameSettings.nbSeats,
          turnIntervalSeconds: newGameSettings.turnIntervalSeconds,
          ruleset: TEST_RULESET_SUMMARY,
        },
        startedAt: null,
        creator: expectedCreator,
        players: [expectedCreator],
        status: GameStatus.WAITING_FOR_PLAYERS,
        canJoin: false,
        canLeave: false,
        canStart: false,
        canOpen: false, // Because anonymous
      })
    })

    it("should only allow joined players to open a started game", async () => {
      // Arrange
      await using apiServer = new ApiServer(await createApiStub())
      const creator = await apiServer.createClient({ authenticated: true })
      const viewer = await apiServer.createClient({ authenticated: true })
      const anonymous = await apiServer.createClient({ authenticated: false })

      const { createdGameId } = await creator.client.lobbies.create.mutate({ configuration: createLobbyConfigurationDtoStub() })
      await creator.client.gameplay.startGame.mutate({ gameId: createdGameId })

      // Act
      const playerLobby = await creator.client.lobbies.getById.query({ gameId: createdGameId })
      const nonPlayerLobby = await viewer.client.lobbies.getById.query({ gameId: createdGameId })
      const anonymousLobby = await anonymous.client.lobbies.getById.query({ gameId: createdGameId })

      // Assert
      expect({
        player: { status: playerLobby.status, canOpen: playerLobby.canOpen },
        nonPlayer: { status: nonPlayerLobby.status, canOpen: nonPlayerLobby.canOpen },
        anonymous: { status: anonymousLobby.status, canOpen: anonymousLobby.canOpen },
      }).toStrictEqual({
        player: { status: GameStatus.IN_PROGRESS, canOpen: true },
        nonPlayer: { status: GameStatus.IN_PROGRESS, canOpen: false },
        anonymous: { status: GameStatus.IN_PROGRESS, canOpen: false },
      })
    })

    it("should return not found when getting a missing lobby by id", async () => {
      // Arrange
      await using apiServer = new ApiServer(await createApiStub())
      const anonymous = await apiServer.createClient({ authenticated: false })

      // Act
      const getLobby = anonymous.client.lobbies.getById.query({ gameId: 404 })

      // Assert
      await expect(getLobby).rejects.toMatchObject({ data: { code: "NOT_FOUND" } })
    })
  })

  describe("join", () => {
    it("should allocate high-contrast colors first in a small lobby", async () => {
      // Arrange
      await using apiServer = new ApiServer(await createApiStub())
      const creator = await apiServer.createClient({ authenticated: true })
      const firstJoiner = await apiServer.createClient({ authenticated: true })
      const secondJoiner = await apiServer.createClient({ authenticated: true })
      const thirdJoiner = await apiServer.createClient({ authenticated: true })
      const { createdGameId } = await creator.client.lobbies.create.mutate({
        configuration: createLobbyConfigurationDtoStub({ nbSeats: 4 }),
      })

      // Act
      await firstJoiner.client.lobbies.join.mutate({ gameId: createdGameId })
      await secondJoiner.client.lobbies.join.mutate({ gameId: createdGameId })
      await thirdJoiner.client.lobbies.join.mutate({ gameId: createdGameId })

      // Assert
      const lobby = await creator.client.lobbies.getById.query({ gameId: createdGameId })
      const colorsByPlayerId = new Map(lobby.players.map(({ id, color }) => [id, color]))
      expect(colorsByPlayerId.get(branded<PlayerId>(creator.account.id))).toBe(PlayerColor.TURQUOISE)
      expect(colorsByPlayerId.get(branded<PlayerId>(firstJoiner.account.id))).toBe(PlayerColor.PINK)
      expect(colorsByPlayerId.get(branded<PlayerId>(secondJoiner.account.id))).toBe(PlayerColor.YELLOW)
      expect(colorsByPlayerId.get(branded<PlayerId>(thirdJoiner.account.id))).toBe(PlayerColor.ORANGE)
    })

    it("should assign every player color in a maximum sized lobby", async () => {
      // Arrange
      await using apiServer = new ApiServer(await createApiStub())
      const creator = await apiServer.createClient({ authenticated: true })
      const joiners = await Promise.all(
        Array.from({ length: MAX_NB_SEATS - 1 }, async () => await apiServer.createClient({ authenticated: true })),
      )
      const { createdGameId } = await creator.client.lobbies.create.mutate({
        configuration: createLobbyConfigurationDtoStub({ nbSeats: MAX_NB_SEATS }),
      })

      // Act
      await Promise.all(joiners.map(async (joiner) => await joiner.client.lobbies.join.mutate({ gameId: createdGameId })))

      // Assert
      const lobby = await creator.client.lobbies.getById.query({ gameId: createdGameId })
      expect(new Set(lobby.players.map(({ color }) => color))).toStrictEqual(new Set(Object.values(PlayerColor)))
    })

    it("should assign every player color in a maximum sized lobby as players leave and rejoin", async () => {
      // Arrange
      await using apiServer = new ApiServer(await createApiStub())
      const creator = await apiServer.createClient({ authenticated: true })
      const joiners = await Promise.all(
        Array.from({ length: MAX_NB_SEATS - 1 }, async () => await apiServer.createClient({ authenticated: true })),
      )
      const { createdGameId } = await creator.client.lobbies.create.mutate({
        configuration: createLobbyConfigurationDtoStub({ nbSeats: MAX_NB_SEATS }),
      })

      await Promise.all(joiners.map(async (joiner) => await joiner.client.lobbies.join.mutate({ gameId: createdGameId })))

      // Act
      const leavers = joiners.slice(joiners.length / 2)

      await Promise.all(leavers.map(async (leaver) => await leaver.client.lobbies.leave.mutate({ gameId: createdGameId })))

      await Promise.all(leavers.map(async (rejoiner) => await rejoiner.client.lobbies.join.mutate({ gameId: createdGameId })))

      // Assert
      const lobby = await creator.client.lobbies.getById.query({ gameId: createdGameId })
      expect(new Set(lobby.players.map(({ color }) => color))).toStrictEqual(new Set(Object.values(PlayerColor)))
    })

    it("should join a game", async () => {
      // Arrange
      await using apiServer = new ApiServer(await createApiStub())
      const creator = await apiServer.createClient({ authenticated: true })
      const joiner = await apiServer.createClient({ authenticated: true })

      const newGameSettings = createLobbyConfigurationDtoStub({ nbSeats: 2 })
      const { createdGameId } = await creator.client.lobbies.create.mutate({ configuration: newGameSettings })

      // Act
      const joinGameResult = await joiner.client.lobbies.join.mutate({ gameId: createdGameId })

      // Assert
      expect(joinGameResult).toStrictEqual<typeof joinGameResult>({ playerId: branded(joiner.account.id) })

      const joinedLobby = await joiner.client.lobbies.getById.query({ gameId: createdGameId })
      const expectedCreator: LobbyPlayerDto = {
        id: branded(creator.account.id),
        alias: creator.account.alias,
        color: PlayerColor.TURQUOISE,
      }
      const expectedJoiner: LobbyPlayerDto = {
        id: branded(joiner.account.id),
        alias: joiner.account.alias,
        color: PlayerColor.PINK,
      }

      expect(joinedLobby).toStrictEqual<typeof joinedLobby>({
        id: createdGameId,
        createdAt: expect.any(String),
        endedAt: null,
        winnerAccountId: null,
        configuration: {
          name: newGameSettings.name,
          nbSeats: newGameSettings.nbSeats,
          turnIntervalSeconds: newGameSettings.turnIntervalSeconds,
          ruleset: TEST_RULESET_SUMMARY,
        },
        startedAt: null,
        creator: expectedCreator,
        players: [expectedCreator, expectedJoiner],
        status: GameStatus.READY_TO_START,
        canJoin: false,
        canLeave: true,
        canStart: false,
        canOpen: false,
      })
    })

    it("should reject joining a game that is full", async () => {
      // Arrange
      const { api, accountsRepository } = await createApiStub()
      await using apiServer = new ApiServer({ api, accountsRepository })
      const creator = await apiServer.createClient({ authenticated: true })
      const player = await apiServer.createClient({ authenticated: true })
      const joiner = await apiServer.createClient({ authenticated: true })

      const { createdGameId } = await creator.client.lobbies.create.mutate({
        configuration: createLobbyConfigurationDtoStub({ nbSeats: 2 }),
      })

      await player.client.lobbies.join.mutate({ gameId: createdGameId })

      // Act
      const joinGame = joiner.client.lobbies.join.mutate({ gameId: createdGameId })

      // Assert
      await expect(joinGame).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })

      const lobby = await creator.client.lobbies.getById.query({ gameId: createdGameId })
      expect(lobby.players).toHaveLength(2)
    })

    it("should reject joining a game that has started", async () => {
      // Arrange
      await using apiServer = new ApiServer(await createApiStub())
      const creator = await apiServer.createClient({ authenticated: true })
      const joiner = await apiServer.createClient({ authenticated: true })

      const { createdGameId } = await creator.client.lobbies.create.mutate({ configuration: createLobbyConfigurationDtoStub() })
      await creator.client.gameplay.startGame.mutate({ gameId: createdGameId })

      // Act
      const joinGame = joiner.client.lobbies.join.mutate({ gameId: createdGameId })

      // Assert
      await expect(joinGame).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })

      const lobby = await creator.client.lobbies.getById.query({ gameId: createdGameId })
      expect(lobby.players).toHaveLength(1)
    })

    it("should successfully join a game the player is already in without joining twice", async () => {
      // Arrange
      await using apiServer = new ApiServer(await createApiStub())
      const creator = await apiServer.createClient({ authenticated: true })
      const joiner = await apiServer.createClient({ authenticated: true })

      const { createdGameId } = await creator.client.lobbies.create.mutate({
        configuration: createLobbyConfigurationDtoStub({ nbSeats: 3 }),
      })
      await joiner.client.lobbies.join.mutate({ gameId: createdGameId })

      // Act
      const joinResult = await joiner.client.lobbies.join.mutate({ gameId: createdGameId })

      // Assert
      expect(joinResult).toStrictEqual({ playerId: branded(joiner.account.id) })
      const lobby = await creator.client.lobbies.getById.query({ gameId: createdGameId })
      expect(lobby.players).toHaveLength(2)
      expect(lobby.status).toBe(GameStatus.WAITING_FOR_PLAYERS)
    })

    it("should reject anonymous game join", async () => {
      // Arrange
      await using apiServer = new ApiServer(await createApiStub())
      const anonymous = await apiServer.createClient({ authenticated: false })

      // Act
      const joinGame = anonymous.client.lobbies.join.mutate({ gameId: 1 })

      // Assert
      await expect(joinGame).rejects.toMatchObject({ data: { code: "UNAUTHORIZED" } })
    })
  })

  describe("leave", () => {
    it("should leave a game", async () => {
      // Arrange
      await using apiServer = new ApiServer(await createApiStub())
      const creator = await apiServer.createClient({ authenticated: true })
      const leaver = await apiServer.createClient({ authenticated: true })

      const newGameSettings = createLobbyConfigurationDtoStub({ nbSeats: 2 })
      const { createdGameId } = await creator.client.lobbies.create.mutate({ configuration: newGameSettings })

      await leaver.client.lobbies.join.mutate({ gameId: createdGameId })

      // Act
      const leaveGameResult = await leaver.client.lobbies.leave.mutate({ gameId: createdGameId })

      // Assert
      expect(leaveGameResult).toBe<typeof leaveGameResult>(true)

      const leftLobby = await leaver.client.lobbies.getById.query({ gameId: createdGameId })
      const expectedCreator: LobbyPlayerDto = {
        id: branded(creator.account.id),
        alias: creator.account.alias,
        color: PlayerColor.TURQUOISE,
      }

      expect(leftLobby).toStrictEqual<typeof leftLobby>({
        id: createdGameId,
        createdAt: expect.any(String),
        endedAt: null,
        winnerAccountId: null,
        configuration: {
          name: newGameSettings.name,
          nbSeats: newGameSettings.nbSeats,
          turnIntervalSeconds: newGameSettings.turnIntervalSeconds,
          ruleset: TEST_RULESET_SUMMARY,
        },
        startedAt: null,
        creator: expectedCreator,
        players: [expectedCreator],
        status: GameStatus.WAITING_FOR_PLAYERS,
        canJoin: true, // Because left
        canLeave: false, // Because left
        canStart: false, // Because not creator
        canOpen: false, // Because not joined
      })
    })

    it("should reject leaving a game that has started", async () => {
      // Arrange
      await using apiServer = new ApiServer(await createApiStub())
      const creator = await apiServer.createClient({ authenticated: true })
      const leaver = await apiServer.createClient({ authenticated: true })

      const { createdGameId } = await creator.client.lobbies.create.mutate({ configuration: createLobbyConfigurationDtoStub() })
      await leaver.client.lobbies.join.mutate({ gameId: createdGameId })
      await creator.client.gameplay.startGame.mutate({ gameId: createdGameId })

      // Act
      const leaveGame = leaver.client.lobbies.leave.mutate({ gameId: createdGameId })

      // Assert
      await expect(leaveGame).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
    })

    it("should reject leaving a game as its creator", async () => {
      // Arrange
      await using apiServer = new ApiServer(await createApiStub())
      const player = await apiServer.createClient({ authenticated: true })

      const { createdGameId } = await player.client.lobbies.create.mutate({ configuration: createLobbyConfigurationDtoStub() })

      // Act
      const leaveGame = player.client.lobbies.leave.mutate({ gameId: createdGameId })

      // Assert
      await expect(leaveGame).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
    })

    it("should successfully leave a game the player has not joined", async () => {
      // Arrange
      await using apiServer = new ApiServer(await createApiStub())
      const creator = await apiServer.createClient({ authenticated: true })
      const nonPlayer = await apiServer.createClient({ authenticated: true })

      const { createdGameId } = await creator.client.lobbies.create.mutate({ configuration: createLobbyConfigurationDtoStub() })

      // Act
      const leaveResult = await nonPlayer.client.lobbies.leave.mutate({ gameId: createdGameId })

      // Assert
      expect(leaveResult).toBe(true)
      const lobby = await creator.client.lobbies.getById.query({ gameId: createdGameId })
      expect(lobby.players).toHaveLength(1)
    })

    it("should reject anonymous game leave", async () => {
      // Arrange
      await using apiServer = new ApiServer(await createApiStub())
      const anonymous = await apiServer.createClient({ authenticated: false })

      // Act
      const leaveGame = anonymous.client.lobbies.leave.mutate({ gameId: 1 })

      // Assert
      await expect(leaveGame).rejects.toMatchObject({ data: { code: "UNAUTHORIZED" } })
    })
  })
})
