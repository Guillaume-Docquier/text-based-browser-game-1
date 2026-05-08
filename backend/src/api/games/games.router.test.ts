import { describe, expect, it } from "vitest"
import { AuthServiceMock } from "#api/auth/auth.service.mock.ts"
import { createApiStub } from "#api/createApi.stub.ts"
import { createDbMock } from "#lib/db/createDb.mock.ts"
import { createPlayerRowInsertStub } from "#lib/db/playerRowInsert.stub.ts"
import { TrpcClient } from "#tests/TrpcClient.ts"
import { createPlayer } from "#tests/createPlayer.ts"
import { GameSummaryStatus } from "#api/games/games.controller.ts"

describe("games router", () => {
  it("creates a game for the authenticated player", async () => {
    // Arrange
    const db = await createDbMock()
    const player = await createPlayer(db, createPlayerRowInsertStub())

    const authService = new AuthServiceMock({ player })
    const api = await createApiStub({ db, authService })
    using trpcClient = new TrpcClient({ api })

    // Act
    const createGameResult = await trpcClient.client.games.create.mutate({
      newGame: {
        name: "my new game",
        nbSeats: 43,
        tickIntervalSeconds: 420,
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

  it("rejects anonymous game creation", async () => {
    // Arrange
    const api = await createApiStub()
    using trpcClient = new TrpcClient({ api })

    // Act & Assert
    await expect(
      trpcClient.client.games.create.mutate({ newGame: { name: "my new game", nbSeats: 43, tickIntervalSeconds: 420 } }),
    ).rejects.toMatchObject({
      data: { code: "UNAUTHORIZED" },
    })
  })

  it("gets summaries anonymously with all capability flags disabled", async () => {
    // Arrange
    const db = await createDbMock()
    const player = await createPlayer(db, createPlayerRowInsertStub())

    const authService = new AuthServiceMock({ player })
    const api = await createApiStub({ db, authService })
    using trpcClient = new TrpcClient({ api })

    const createGameResult = await trpcClient.client.games.create.mutate({
      newGame: {
        name: "public game",
        nbSeats: 2,
        tickIntervalSeconds: 60,
      },
    })

    authService.player = undefined

    // Act
    const getSummariesResult = await trpcClient.client.games.getSummaries.query()

    // Assert
    expect(getSummariesResult).toEqual<typeof getSummariesResult>({
      games: [
        {
          id: createGameResult.newGame.id,
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

  it("gets summaries for an authenticated player who can join", async () => {
    // Arrange
    const db = await createDbMock()
    const creator = await createPlayer(db, createPlayerRowInsertStub({ alias: "Creator" }))
    const player = await createPlayer(
      db,
      createPlayerRowInsertStub({ clerk_id: "clerk_player-2", email: "player-2@example.com", alias: "Player 2" }),
    )

    const authService = new AuthServiceMock({ player: creator })
    const api = await createApiStub({ db, authService })
    using trpcClient = new TrpcClient({ api })

    const createGameResult = await trpcClient.client.games.create.mutate({
      newGame: {
        name: "joinable game",
        nbSeats: 2,
        tickIntervalSeconds: 60,
      },
    })

    authService.player = player

    // Act
    const getSummariesResult = await trpcClient.client.games.getSummaries.query()

    // Assert
    expect(getSummariesResult).toEqual<typeof getSummariesResult>({
      games: [
        {
          id: createGameResult.newGame.id,
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

  it("gets a summary by id", async () => {
    // Arrange
    const db = await createDbMock()
    const creator = await createPlayer(db, createPlayerRowInsertStub({ alias: "Creator" }))
    const player = await createPlayer(
      db,
      createPlayerRowInsertStub({ clerk_id: "clerk_player-2", email: "player-2@example.com", alias: "Player 2" }),
    )

    const authService = new AuthServiceMock({ player: creator })
    const api = await createApiStub({ db, authService })
    using trpcClient = new TrpcClient({ api })

    const createGameResult = await trpcClient.client.games.create.mutate({
      newGame: {
        name: "specific game",
        nbSeats: 2,
        tickIntervalSeconds: 60,
      },
    })

    authService.player = player

    // Act
    const getSummaryByIdResult = await trpcClient.client.games.getSummaryById.query({ gameId: createGameResult.newGame.id })

    // Assert
    expect(getSummaryByIdResult).toEqual<typeof getSummaryByIdResult>({
      game: {
        id: createGameResult.newGame.id,
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

  it("returns not found when getting a missing summary by id", async () => {
    // Arrange
    const api = await createApiStub()
    using trpcClient = new TrpcClient({ api })

    // Act & Assert
    await expect(trpcClient.client.games.getSummaryById.query({ gameId: 404 })).rejects.toMatchObject({
      data: { code: "NOT_FOUND" },
    })
  })

  it("joins a game", async () => {
    // Arrange
    const db = await createDbMock()
    const creator = await createPlayer(db, createPlayerRowInsertStub({ alias: "Creator" }))
    const player = await createPlayer(
      db,
      createPlayerRowInsertStub({ clerk_id: "clerk_player-2", email: "player-2@example.com", alias: "Player 2" }),
    )

    const authService = new AuthServiceMock({ player: creator })
    const api = await createApiStub({ db, authService })
    using trpcClient = new TrpcClient({ api })

    const createGameResult = await trpcClient.client.games.create.mutate({
      newGame: {
        name: "join game",
        nbSeats: 2,
        tickIntervalSeconds: 60,
      },
    })

    authService.player = player

    // Act
    const joinGameResult = await trpcClient.client.games.join.mutate({ gameId: createGameResult.newGame.id })

    // Assert
    expect(joinGameResult).toEqual<typeof joinGameResult>({
      joinedGame: {
        id: createGameResult.newGame.id,
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

  it("rejects joining a game the player is already in", async () => {
    // Arrange
    const db = await createDbMock()
    const player = await createPlayer(db, createPlayerRowInsertStub())

    const authService = new AuthServiceMock({ player })
    const api = await createApiStub({ db, authService })
    using trpcClient = new TrpcClient({ api })

    const createGameResult = await trpcClient.client.games.create.mutate({
      newGame: {
        name: "already joined game",
        nbSeats: 2,
        tickIntervalSeconds: 60,
      },
    })

    // Act & Assert
    await expect(trpcClient.client.games.join.mutate({ gameId: createGameResult.newGame.id })).rejects.toMatchObject({
      data: { code: "BAD_REQUEST" },
    })
  })

  it("rejects anonymous game join", async () => {
    // Arrange
    const api = await createApiStub()
    using trpcClient = new TrpcClient({ api })

    // Act & Assert
    await expect(trpcClient.client.games.join.mutate({ gameId: 1 })).rejects.toMatchObject({
      data: { code: "UNAUTHORIZED" },
    })
  })

  it("leaves a game", async () => {
    // Arrange
    const db = await createDbMock()
    const creator = await createPlayer(db, createPlayerRowInsertStub({ alias: "Creator" }))
    const player = await createPlayer(
      db,
      createPlayerRowInsertStub({ clerk_id: "clerk_player-2", email: "player-2@example.com", alias: "Player 2" }),
    )

    const authService = new AuthServiceMock({ player: creator })
    const api = await createApiStub({ db, authService })
    using trpcClient = new TrpcClient({ api })

    const createGameResult = await trpcClient.client.games.create.mutate({
      newGame: {
        name: "leave game",
        nbSeats: 3,
        tickIntervalSeconds: 60,
      },
    })

    authService.player = player
    await trpcClient.client.games.join.mutate({ gameId: createGameResult.newGame.id })

    // Act
    const leaveGameResult = await trpcClient.client.games.leave.mutate({ gameId: createGameResult.newGame.id })

    // Assert
    expect(leaveGameResult).toEqual<typeof leaveGameResult>({
      leftGame: {
        id: createGameResult.newGame.id,
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

  it("rejects leaving a game as its creator", async () => {
    // Arrange
    const db = await createDbMock()
    const player = await createPlayer(db, createPlayerRowInsertStub())

    const authService = new AuthServiceMock({ player })
    const api = await createApiStub({ db, authService })
    using trpcClient = new TrpcClient({ api })

    const createGameResult = await trpcClient.client.games.create.mutate({
      newGame: {
        name: "creator cannot leave game",
        nbSeats: 2,
        tickIntervalSeconds: 60,
      },
    })

    // Act & Assert
    await expect(trpcClient.client.games.leave.mutate({ gameId: createGameResult.newGame.id })).rejects.toMatchObject({
      data: { code: "BAD_REQUEST" },
    })
  })

  it("rejects anonymous game leave", async () => {
    // Arrange
    const api = await createApiStub()
    using trpcClient = new TrpcClient({ api })

    // Act & Assert
    await expect(trpcClient.client.games.leave.mutate({ gameId: 1 })).rejects.toMatchObject({
      data: { code: "UNAUTHORIZED" },
    })
  })

  it("starts a game", async () => {
    // Arrange
    const db = await createDbMock()
    const player = await createPlayer(db, createPlayerRowInsertStub())

    const authService = new AuthServiceMock({ player })
    const api = await createApiStub({ db, authService })
    using trpcClient = new TrpcClient({ api })

    const createGameResult = await trpcClient.client.games.create.mutate({
      newGame: {
        name: "start game",
        nbSeats: 2,
        tickIntervalSeconds: 60,
      },
    })

    // Act
    const startGameResult = await trpcClient.client.games.start.mutate({ gameId: createGameResult.newGame.id })

    // Assert
    expect(startGameResult).toEqual<typeof startGameResult>({
      startedGame: {
        id: createGameResult.newGame.id,
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

  it("rejects starting a game as a non-creator", async () => {
    // Arrange
    const db = await createDbMock()
    const creator = await createPlayer(db, createPlayerRowInsertStub({ alias: "Creator" }))
    const player = await createPlayer(
      db,
      createPlayerRowInsertStub({ clerk_id: "clerk_player-2", email: "player-2@example.com", alias: "Player 2" }),
    )

    const authService = new AuthServiceMock({ player: creator })
    const api = await createApiStub({ db, authService })
    using trpcClient = new TrpcClient({ api })

    const createGameResult = await trpcClient.client.games.create.mutate({
      newGame: {
        name: "non creator cannot start game",
        nbSeats: 2,
        tickIntervalSeconds: 60,
      },
    })

    authService.player = player

    // Act & Assert
    await expect(trpcClient.client.games.start.mutate({ gameId: createGameResult.newGame.id })).rejects.toMatchObject({
      data: { code: "BAD_REQUEST" },
    })
  })

  it("rejects anonymous game start", async () => {
    // Arrange
    const api = await createApiStub()
    using trpcClient = new TrpcClient({ api })

    // Act & Assert
    await expect(trpcClient.client.games.start.mutate({ gameId: 1 })).rejects.toMatchObject({
      data: { code: "UNAUTHORIZED" },
    })
  })
})
