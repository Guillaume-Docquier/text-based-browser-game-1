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
})
