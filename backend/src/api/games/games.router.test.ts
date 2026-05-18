import { describe, expect, it } from "vitest"
import { createApiStub } from "#api/createApi.stub.ts"
import { createPlayerRowInsertStub } from "#lib/db/players/PlayerRowInsert.stub.ts"
import { TrpcClient } from "#tests/TrpcClient.ts"
import { extractSuccess } from "#tests/extractSuccess.ts"
import { GameSummaryStatus } from "#api/games/games.controller.ts"
import { createStarSystemGenerationSettingsStub } from "#lib/db/star-systems/StarSystemGenerationSettings.stub.ts"
import { eq } from "drizzle-orm"
import { starSystemsTable } from "#lib/db/schema.ts"

describe("games.router", () => {
  describe("create", () => {
    it("should create a game for the authenticated player", async () => {
      // Arrange
      const { api, authService, playersRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      const player = extractSuccess(await playersRepository.create(createPlayerRowInsertStub()))
      authService.player = player

      // Act
      const createGameResult = await trpcClient.client.games.create.mutate({
        newGame: {
          name: "my new game",
          nbSeats: 43,
          tickIntervalSeconds: 420,
          starSystemGenerationSettings: createStarSystemGenerationSettingsStub(),
        },
      })

      // Assert
      expect(createGameResult).toEqual<typeof createGameResult>({
        newGame: {
          id: expect.any(Number),
          createdAt: expect.any(String),
          createdByPlayerId: player.id,
          name: "my new game",
          nbSeats: 43,
          tickIntervalSeconds: 420,
          endedAt: null,
          startedAt: null,
          winnerPlayerId: null,
        },
      })
    })

    it("should reject anonymous game creation", async () => {
      // Arrange
      const { api } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      // Act & Assert
      await expect(
        trpcClient.client.games.create.mutate({
          newGame: {
            name: "my new game",
            nbSeats: 43,
            tickIntervalSeconds: 420,
            starSystemGenerationSettings: createStarSystemGenerationSettingsStub(),
          },
        }),
      ).rejects.toMatchObject({
        data: { code: "UNAUTHORIZED" },
      })
    })

    it("should persist a readable Star System when creating a game", async () => {
      // Arrange
      const { api, authService, playersRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      const player = extractSuccess(await playersRepository.create(createPlayerRowInsertStub()))
      authService.player = player

      // Act
      const createGameResult = await trpcClient.client.games.create.mutate({
        newGame: {
          name: "star system game",
          nbSeats: 2,
          tickIntervalSeconds: 60,
          starSystemGenerationSettings: createStarSystemGenerationSettingsStub(),
        },
      })
      const getStarSystemResult = await trpcClient.client.starSystems.getByGameId.query({ gameId: createGameResult.newGame.id })

      // Assert
      expect(getStarSystemResult.starSystem.gameId).toBe(createGameResult.newGame.id)
      expect(getStarSystemResult.starSystem.orbits.length).toBeGreaterThan(0)
      expect(Object.keys(getStarSystemResult.starSystem.movementEdges).length).toBeGreaterThan(0)
    })

    it("should reject invalid Star System generation ranges", async () => {
      // Arrange
      const { api, authService, playersRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      authService.player = extractSuccess(await playersRepository.create(createPlayerRowInsertStub()))

      // Act & Assert
      await expect(
        trpcClient.client.games.create.mutate({
          newGame: {
            name: "invalid system game",
            nbSeats: 2,
            tickIntervalSeconds: 60,
            starSystemGenerationSettings: createStarSystemGenerationSettingsStub({
              planetDensity: { min: 2, max: 2 },
            }),
          },
        }),
      ).rejects.toMatchObject({
        data: { code: "BAD_REQUEST" },
      })
    })

    it("should persist a generated unsigned 32-bit seed when seed is omitted", async () => {
      // Arrange
      const { api, authService, playersRepository, db } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      authService.player = extractSuccess(await playersRepository.create(createPlayerRowInsertStub()))
      const { seed: _seed, ...generationSettingsWithoutSeed } = createStarSystemGenerationSettingsStub()

      // Act
      const createGameResult = await trpcClient.client.games.create.mutate({
        newGame: {
          name: "random seed system game",
          nbSeats: 2,
          tickIntervalSeconds: 60,
          starSystemGenerationSettings: generationSettingsWithoutSeed,
        },
      })

      // Assert
      const starSystems = await db.select().from(starSystemsTable).where(eq(starSystemsTable.gameId, createGameResult.newGame.id))
      expect(starSystems).toHaveLength(1)
      expect(starSystems[0]?.generationSettings).toMatchObject({
        seed: expect.any(Number),
      })
      expect((starSystems[0]?.generationSettings as { seed: number } | undefined)?.seed).toBeGreaterThanOrEqual(0)
      expect((starSystems[0]?.generationSettings as { seed: number } | undefined)?.seed).toBeLessThanOrEqual(4_294_967_295)
    })
  })

  describe("getSummaries", () => {
    it("should get summaries anonymously", async () => {
      // Arrange
      const { api, authService, playersRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      const player = extractSuccess(await playersRepository.create(createPlayerRowInsertStub()))
      authService.player = player

      const { newGame } = await trpcClient.client.games.create.mutate({
        newGame: {
          name: "public game",
          nbSeats: 2,
          tickIntervalSeconds: 60,
          starSystemGenerationSettings: createStarSystemGenerationSettingsStub(),
        },
      })

      authService.player = undefined

      // Act
      const getSummariesResult = await trpcClient.client.games.getSummaries.query()

      // Assert
      expect(getSummariesResult).toEqual<typeof getSummariesResult>({
        games: [
          {
            id: newGame.id,
            createdAt: expect.any(String),
            endedAt: null,
            winnerPlayerId: null,
            name: "public game",
            nbSeats: 2,
            tickIntervalSeconds: 60,
            startedAt: null,
            creator: {
              id: player.id,
              alias: player.alias,
            },
            players: [
              {
                id: player.id,
                alias: player.alias,
              },
            ],
            status: GameSummaryStatus.WAITING_FOR_PLAYERS,
            canJoin: false, // because anonymous
            canLeave: false, // because not in the game
            canStart: false, // because not the creator
          },
        ],
      })
    })

    it("should get summaries for an authenticated player who can join", async () => {
      // Arrange
      const { api, authService, playersRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      const creator = extractSuccess(await playersRepository.create(createPlayerRowInsertStub({ alias: "Creator" })))
      const player = extractSuccess(await playersRepository.create(createPlayerRowInsertStub({ alias: "Player 2" })))
      authService.player = creator

      const { newGame } = await trpcClient.client.games.create.mutate({
        newGame: {
          name: "joinable game",
          nbSeats: 2,
          tickIntervalSeconds: 60,
          starSystemGenerationSettings: createStarSystemGenerationSettingsStub(),
        },
      })

      authService.player = player

      // Act
      const getSummariesResult = await trpcClient.client.games.getSummaries.query()

      // Assert
      expect(getSummariesResult).toEqual<typeof getSummariesResult>({
        games: [
          {
            id: newGame.id,
            createdAt: expect.any(String),
            endedAt: null,
            winnerPlayerId: null,
            name: "joinable game",
            nbSeats: 2,
            tickIntervalSeconds: 60,
            startedAt: null,
            creator: {
              id: creator.id,
              alias: creator.alias,
            },
            players: [
              {
                id: creator.id,
                alias: creator.alias,
              },
            ],
            status: GameSummaryStatus.WAITING_FOR_PLAYERS,
            canJoin: true, // because not in the game
            canLeave: false, // because not in the game
            canStart: false, // because not the creator
          },
        ],
      })
    })
  })

  describe("getSummaryById", () => {
    it("should get a summary by id when authenticated", async () => {
      // Arrange
      const { api, authService, playersRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      const creator = extractSuccess(await playersRepository.create(createPlayerRowInsertStub({ alias: "Creator" })))
      const player = extractSuccess(await playersRepository.create(createPlayerRowInsertStub({ alias: "Player 2" })))
      authService.player = creator

      const { newGame } = await trpcClient.client.games.create.mutate({
        newGame: {
          name: "specific game",
          nbSeats: 2,
          tickIntervalSeconds: 60,
          starSystemGenerationSettings: createStarSystemGenerationSettingsStub(),
        },
      })

      authService.player = player

      // Act
      const getSummaryByIdResult = await trpcClient.client.games.getSummaryById.query({ gameId: newGame.id })

      // Assert
      expect(getSummaryByIdResult).toEqual<typeof getSummaryByIdResult>({
        game: {
          id: newGame.id,
          createdAt: expect.any(String),
          endedAt: null,
          winnerPlayerId: null,
          name: "specific game",
          nbSeats: 2,
          tickIntervalSeconds: 60,
          startedAt: null,
          creator: {
            id: creator.id,
            alias: creator.alias,
          },
          players: [
            {
              id: creator.id,
              alias: creator.alias,
            },
          ],
          status: GameSummaryStatus.WAITING_FOR_PLAYERS,
          canJoin: true,
          canLeave: false,
          canStart: false,
        },
      })
    })

    it("should get a summary by id anonymously", async () => {
      // Arrange

      const { api, authService, playersRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      const creator = extractSuccess(await playersRepository.create(createPlayerRowInsertStub({ alias: "Creator" })))
      authService.player = creator

      const { newGame } = await trpcClient.client.games.create.mutate({
        newGame: {
          name: "specific game",
          nbSeats: 2,
          tickIntervalSeconds: 60,
          starSystemGenerationSettings: createStarSystemGenerationSettingsStub(),
        },
      })

      authService.player = undefined

      // Act
      const getSummaryByIdResult = await trpcClient.client.games.getSummaryById.query({ gameId: newGame.id })

      // Assert
      expect(getSummaryByIdResult).toEqual<typeof getSummaryByIdResult>({
        game: {
          id: newGame.id,
          createdAt: expect.any(String),
          endedAt: null,
          winnerPlayerId: null,
          name: "specific game",
          nbSeats: 2,
          tickIntervalSeconds: 60,
          startedAt: null,
          creator: {
            id: creator.id,
            alias: creator.alias,
          },
          players: [
            {
              id: creator.id,
              alias: creator.alias,
            },
          ],
          status: GameSummaryStatus.WAITING_FOR_PLAYERS,
          canJoin: false,
          canLeave: false,
          canStart: false,
        },
      })
    })

    it("should return not found when getting a missing summary by id", async () => {
      // Arrange
      const { api } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      // Act & Assert
      await expect(trpcClient.client.games.getSummaryById.query({ gameId: 404 })).rejects.toMatchObject({
        data: { code: "NOT_FOUND" },
      })
    })
  })

  describe("join", () => {
    it("should join a game", async () => {
      // Arrange
      const { api, authService, playersRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      const creator = extractSuccess(await playersRepository.create(createPlayerRowInsertStub({ alias: "Creator" })))
      const player = extractSuccess(await playersRepository.create(createPlayerRowInsertStub({ alias: "Player 2" })))
      authService.player = creator

      const { newGame } = await trpcClient.client.games.create.mutate({
        newGame: {
          name: "join game",
          nbSeats: 2,
          tickIntervalSeconds: 60,
          starSystemGenerationSettings: createStarSystemGenerationSettingsStub(),
        },
      })

      authService.player = player

      // Act
      const joinGameResult = await trpcClient.client.games.join.mutate({ gameId: newGame.id })

      // Assert
      expect(joinGameResult).toEqual<typeof joinGameResult>({
        joinedGame: {
          id: newGame.id,
          createdAt: expect.any(String),
          endedAt: null,
          winnerPlayerId: null,
          name: "join game",
          nbSeats: 2,
          tickIntervalSeconds: 60,
          startedAt: null,
          creator: {
            id: creator.id,
            alias: creator.alias,
          },
          players: [
            {
              id: creator.id,
              alias: creator.alias,
            },
            {
              id: player.id,
              alias: player.alias,
            },
          ],
          status: GameSummaryStatus.READY_TO_START,
          canJoin: false,
          canLeave: true,
          canStart: false,
        },
      })
    })

    it("should reject joining a game the player is already in", async () => {
      // Arrange
      const { api, authService, playersRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      authService.player = extractSuccess(await playersRepository.create(createPlayerRowInsertStub()))

      const { newGame } = await trpcClient.client.games.create.mutate({
        newGame: {
          name: "already joined game",
          nbSeats: 2,
          tickIntervalSeconds: 60,
          starSystemGenerationSettings: createStarSystemGenerationSettingsStub(),
        },
      })

      // Act & Assert
      await expect(trpcClient.client.games.join.mutate({ gameId: newGame.id })).rejects.toMatchObject({
        data: { code: "BAD_REQUEST" },
      })
    })

    it("should reject anonymous game join", async () => {
      // Arrange
      const { api } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      // Act & Assert
      await expect(trpcClient.client.games.join.mutate({ gameId: 1 })).rejects.toMatchObject({
        data: { code: "UNAUTHORIZED" },
      })
    })
  })

  describe("leave", () => {
    it("should leave a game", async () => {
      // Arrange
      const { api, authService, playersRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      const creator = extractSuccess(await playersRepository.create(createPlayerRowInsertStub({ alias: "Creator" })))
      const player = extractSuccess(await playersRepository.create(createPlayerRowInsertStub({ alias: "Player 2" })))
      authService.player = creator

      const { newGame } = await trpcClient.client.games.create.mutate({
        newGame: {
          name: "leave game",
          nbSeats: 3,
          tickIntervalSeconds: 60,
          starSystemGenerationSettings: createStarSystemGenerationSettingsStub(),
        },
      })

      authService.player = player
      await trpcClient.client.games.join.mutate({ gameId: newGame.id })

      // Act
      const leaveGameResult = await trpcClient.client.games.leave.mutate({ gameId: newGame.id })

      // Assert
      expect(leaveGameResult).toEqual<typeof leaveGameResult>({
        leftGame: {
          id: newGame.id,
          createdAt: expect.any(String),
          endedAt: null,
          winnerPlayerId: null,
          name: "leave game",
          nbSeats: 3,
          tickIntervalSeconds: 60,
          startedAt: null,
          creator: {
            id: creator.id,
            alias: creator.alias,
          },
          players: [
            {
              id: creator.id,
              alias: creator.alias,
            },
          ],
          status: GameSummaryStatus.WAITING_FOR_PLAYERS,
          canJoin: true,
          canLeave: false,
          canStart: false,
        },
      })
    })

    it("should reject leaving a game as its creator", async () => {
      // Arrange
      const { api, authService, playersRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      authService.player = extractSuccess(await playersRepository.create(createPlayerRowInsertStub()))

      const { newGame } = await trpcClient.client.games.create.mutate({
        newGame: {
          name: "creator cannot leave game",
          nbSeats: 2,
          tickIntervalSeconds: 60,
          starSystemGenerationSettings: createStarSystemGenerationSettingsStub(),
        },
      })

      // Act & Assert
      await expect(trpcClient.client.games.leave.mutate({ gameId: newGame.id })).rejects.toMatchObject({
        data: { code: "BAD_REQUEST" },
      })
    })

    it("should reject anonymous game leave", async () => {
      // Arrange
      const { api } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      // Act & Assert
      await expect(trpcClient.client.games.leave.mutate({ gameId: 1 })).rejects.toMatchObject({
        data: { code: "UNAUTHORIZED" },
      })
    })
  })

  describe("start", () => {
    it("should start a game", async () => {
      // Arrange
      const { api, authService, playersRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      const player = extractSuccess(await playersRepository.create(createPlayerRowInsertStub()))
      authService.player = player

      const { newGame } = await trpcClient.client.games.create.mutate({
        newGame: {
          name: "start game",
          nbSeats: 2,
          tickIntervalSeconds: 60,
          starSystemGenerationSettings: createStarSystemGenerationSettingsStub(),
        },
      })

      // Act
      const startGameResult = await trpcClient.client.games.start.mutate({ gameId: newGame.id })

      // Assert
      expect(startGameResult).toEqual<typeof startGameResult>({
        startedGame: {
          id: newGame.id,
          createdAt: expect.any(String),
          endedAt: null,
          winnerPlayerId: null,
          name: "start game",
          nbSeats: 2,
          tickIntervalSeconds: 60,
          startedAt: expect.any(String),
          creator: {
            id: player.id,
            alias: player.alias,
          },
          players: [
            {
              id: player.id,
              alias: player.alias,
            },
          ],
          status: GameSummaryStatus.STARTED,
          canJoin: false,
          canLeave: false,
          canStart: false,
        },
      })
    })

    it("should reject starting a game as a non-creator", async () => {
      // Arrange
      const { api, authService, playersRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      const creator = extractSuccess(await playersRepository.create(createPlayerRowInsertStub({ alias: "Creator" })))
      const player = extractSuccess(await playersRepository.create(createPlayerRowInsertStub({ alias: "Player 2" })))
      authService.player = creator

      const { newGame } = await trpcClient.client.games.create.mutate({
        newGame: {
          name: "non creator cannot start game",
          nbSeats: 2,
          tickIntervalSeconds: 60,
          starSystemGenerationSettings: createStarSystemGenerationSettingsStub(),
        },
      })

      authService.player = player

      // Act & Assert
      await expect(trpcClient.client.games.start.mutate({ gameId: newGame.id })).rejects.toMatchObject({
        data: { code: "BAD_REQUEST" },
      })
    })

    it("should reject anonymous game start", async () => {
      // Arrange
      const { api } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      // Act & Assert
      await expect(trpcClient.client.games.start.mutate({ gameId: 1 })).rejects.toMatchObject({
        data: { code: "UNAUTHORIZED" },
      })
    })
  })
})
