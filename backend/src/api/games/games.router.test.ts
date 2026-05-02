import { createTRPCClient, httpBatchLink } from "@trpc/client"
import { Logger } from "@guillaume-docquier/tools-ts"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { drizzle } from "drizzle-orm/node-postgres"
import type { NodePgDatabase } from "drizzle-orm/node-postgres"
import type { Server } from "node:http"
import { createApi, type TrpcRouter } from "#api/createApi.ts"
import { AuthServiceMock } from "#api/auth/auth.service.mock.ts"
import { PlayersRepository } from "#lib/db/players.repository.ts"
import { GamesRepository } from "#lib/db/games.repository.ts"
import { GameStatesRepository } from "#lib/db/gameStates.repository.ts"
import { GamePlayerResourcesRepository } from "#lib/db/gamePlayerResources.repository.ts"
import { GamePlayerActionsRepository } from "#lib/db/gamePlayerActions.repository.ts"
import * as schema from "#lib/db/schema.ts"
import type { Player } from "#api/players/players.controller.ts"
import type { PostgresRepository } from "#lib/db/PostgresRepository.ts"
import type { AddressInfo } from "node:net"
import { createPlayerStub } from "#api/players/player.stub.ts"
import { createGameRowStub } from "#lib/db/gameRow.stub.ts"

type RecordedQuery = {
  sql: string
  params: unknown[]
}

type MockQuery = {
  text: string
}

type MockClient = {
  query: (query: MockQuery | string, params: unknown[] | undefined) => Promise<{ rows: unknown[][] }>
}

type ApiTestContext = {
  authService: AuthServiceMock
  client: ReturnType<typeof createTRPCClient<TrpcRouter>>
  closeServer: () => Promise<void>
  queueRows: (rows?: unknown[][]) => void
  recordedQueries: RecordedQuery[]
}

const mockPlayer = createPlayerStub({ id: 1 })
const otherPlayer = createPlayerStub({ id: 2 })

describe("games router", () => {
  let context: ApiTestContext

  beforeEach(async () => {
    context = await createApiTestContext()
  })

  afterEach(async () => {
    await context.closeServer()
  })

  it("creates a game for the authenticated player", async () => {
    const gameRow = createGameRowStub({ createdByPlayerId: mockPlayer.id })

    context.authService.player = mockPlayer
    context.queueRows()
    context.queueRows([gameRowToArray(gameRow)])
    context.queueRows()
    context.queueRows([summaryRowToArray({ game: gameRow, creator: mockPlayer, player: undefined })])
    context.queueRows()
    context.queueRows()
    context.queueRows()

    const result = await context.client.games.create.mutate({
      newGame: {
        name: gameRow.name,
        nbSeats: gameRow.nbSeats,
        tickIntervalSeconds: gameRow.tickIntervalSeconds,
      },
    })

    expect(result.newGame).toEqual({
      ...gameRow,
      createdAt: gameRow.createdAt.toISOString(),
    })

    const insertGameQuery = context.recordedQueries.find((query) => query.sql.includes('insert into "games"'))
    expect(insertGameQuery?.params).toEqual([gameRow.name, mockPlayer.id, gameRow.nbSeats, gameRow.tickIntervalSeconds])
    expect(context.recordedQueries.map((query) => query.sql)).toEqual([
      "begin",
      expect.stringContaining('insert into "games"'),
      "savepoint sp1",
      expect.stringContaining('from "games"'),
      expect.stringContaining('insert into "game_players"'),
      "release savepoint sp1",
      "commit",
    ])
  })

  it("rejects anonymous game creation without querying the database", async () => {
    context.authService.player = undefined
    await expect(
      context.client.games.create.mutate({
        newGame: {
          name: "Anonymous Game",
          nbSeats: 2,
          tickIntervalSeconds: 60,
        },
      }),
    ).rejects.toMatchObject({
      data: {
        code: "UNAUTHORIZED",
      },
    })
    expect(context.recordedQueries).toEqual([])
  })

  it("gets summaries anonymously with all capability flags disabled", async () => {
    const gameRow = createGameRowStub({ createdByPlayerId: mockPlayer.id })

    context.authService.player = undefined
    context.queueRows([summaryRowToArray({ game: gameRow, creator: mockPlayer, player: mockPlayer })])

    const result = await context.client.games.getSummaries.query()

    expect(result.games).toEqual([
      {
        id: gameRow.id,
        name: gameRow.name,
        winnerPlayerId: null,
        nbSeats: gameRow.nbSeats,
        tickIntervalSeconds: gameRow.tickIntervalSeconds,
        createdAt: gameRow.createdAt.toISOString(),
        startedAt: null,
        endedAt: null,
        creator: {
          id: mockPlayer.id,
          alias: mockPlayer.alias,
        },
        players: [
          {
            id: mockPlayer.id,
            alias: mockPlayer.alias,
          },
        ],
        status: "WAITING_FOR_PLAYERS",
        canJoin: false,
        canLeave: false,
        canStart: false,
      },
    ])
  })

  it("gets summaries for an authenticated player who can join", async () => {
    const gameRow = createGameRowStub({ createdByPlayerId: mockPlayer.id })

    context.authService.player = otherPlayer
    context.queueRows([summaryRowToArray({ game: gameRow, creator: mockPlayer, player: mockPlayer })])

    const result = await context.client.games.getSummaries.query()

    expect(result.games).toEqual([
      expect.objectContaining({
        id: gameRow.id,
        status: "WAITING_FOR_PLAYERS",
        canJoin: true,
        canLeave: false,
        canStart: false,
      }),
    ])
  })
})

async function createApiTestContext(): Promise<ApiTestContext> {
  const { db, queueRows, recordedQueries } = createMockDb()
  const logger = Logger.get()
  const authService = new AuthServiceMock()
  const app = await createApi({
    authService,
    logger,
    playersRepository: new PlayersRepository({ logger, db }),
    gamesRepository: new GamesRepository({ logger, db }),
    gameStatesRepository: new GameStatesRepository({ logger, db }),
    gamePlayerResourcesRepository: new GamePlayerResourcesRepository({ logger, db }),
    gamePlayerActionsRepository: new GamePlayerActionsRepository({ logger, db }),
  })
  const server = await listen(app)
  const address = server.address() as AddressInfo

  return {
    authService,
    client: createTRPCClient<TrpcRouter>({
      links: [
        httpBatchLink({
          url: `http://127.0.0.1:${address.port}/trpc`,
        }),
      ],
    }),
    closeServer: async (): Promise<void> => {
      await close(server)
    },
    queueRows,
    recordedQueries,
  }
}

function createMockDb(): {
  db: PostgresRepository["db"]
  queueRows: (rows?: unknown[][]) => void
  recordedQueries: RecordedQuery[]
} {
  const db = drizzle.mock({ schema }) as unknown as PostgresRepository["db"]
  const queuedResponses: Array<{ rows: unknown[][] }> = []
  const recordedQueries: RecordedQuery[] = []
  const client: MockClient = {
    query: async (query, params): Promise<{ rows: unknown[][] }> => {
      const sql = typeof query === "string" ? query : query.text
      recordedQueries.push({ sql, params: params ?? [] })

      const response = queuedResponses.shift()
      if (response === undefined) {
        throw new Error(`No queued DB response for query: ${sql}`)
      }

      return response
    },
  }
  const dbWithSession = db as unknown as NodePgDatabase & { _: { session: { client: MockClient } } }
  dbWithSession._.session.client = client

  return {
    db,
    queueRows: (rows = []): void => {
      queuedResponses.push({ rows })
    },
    recordedQueries,
  }
}

async function listen(app: { listen: (port: number, callback: () => void) => Server }): Promise<Server> {
  return await new Promise((resolve) => {
    const server = app.listen(0, () => {
      resolve(server)
    })
  })
}

async function close(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error === undefined) {
        resolve()
        return
      }

      reject(error)
    })
  })
}

function gameRowToArray(gameRow: {
  id: number
  name: string
  createdByPlayerId: number
  winnerPlayerId: number | null
  nbSeats: number
  tickIntervalSeconds: number
  createdAt: Date
  startedAt: Date | null
  endedAt: Date | null
}): unknown[] {
  return [
    gameRow.id,
    gameRow.name,
    gameRow.createdByPlayerId,
    gameRow.winnerPlayerId,
    gameRow.nbSeats,
    gameRow.tickIntervalSeconds,
    gameRow.createdAt,
    gameRow.startedAt,
    gameRow.endedAt,
  ]
}

function summaryRowToArray({
  creator,
  game,
  player,
}: {
  game: Parameters<typeof gameRowToArray>[0]
  creator: Player
  player: Player | undefined
}): unknown[] {
  return [...gameRowToArray(game), creator.id, creator.alias, player?.id ?? null, player?.alias ?? null]
}
