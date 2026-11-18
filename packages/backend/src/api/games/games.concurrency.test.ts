import { type Failure, Result, type Success } from "@guillaume-docquier/tools-ts"
import type { PgTable } from "drizzle-orm/pg-core"
import { createGameConfigurationStub } from "shared/domain/games/GameConfiguration.stub.ts"
import { GameStatus } from "shared/domain/games/GameStatus.ts"
import { describe, expect } from "vitest"
import { gamesTable, playersTable, turnsTable } from "#lib/db/schema.ts"
import { ConcurrencyTestApiServer } from "#tests/ConcurrencyTestApiServer.ts"
import type { PostgresConcurrency } from "#tests/PostgresConcurrency.ts"
import { concurrencyTest } from "#tests/vitest.concurrency.fixture.ts"

describe("lobby concurrency", () => {
  concurrencyTest.for([
    {
      name: "should accept one join and report a full lobby for the other when both compete for the last seat",
      nbSeats: 2,
      expectedSecondRaceResult: conflict("The lobby is full."),
      expectedLobbyAliases: ["alice", "creator"],
    },
    {
      name: "should accept both joins and assign distinct colors when seats are available",
      nbSeats: 3,
      expectedSecondRaceResult: ok(),
      expectedLobbyAliases: ["alice", "bob", "creator"],
    },
  ] as const)("$name", async ({ nbSeats, expectedSecondRaceResult, expectedLobbyAliases }, { postgres }) => {
    // Arrange
    await using server = await ConcurrencyTestApiServer.create(postgres)
    const creator = await server.createClient({ authenticated: true, alias: "creator" })
    const alice = await server.createClient({ authenticated: true, alias: "alice" })
    const bob = await server.createClient({ authenticated: true, alias: "bob" })

    const { createdGameId: gameId } = await creator.client.games.create.mutate({
      configuration: createGameConfigurationStub({ nbSeats }),
    })

    // Act
    const { firstRaceResult, secondRaceResult } = await runLobbyRace({
      concurrency: postgres.concurrency,
      block: { table: playersTable, command: "insert" },
      firstOperation: async () => await alice.client.games.join.mutate({ gameId }),
      secondOperation: async () => await bob.client.games.join.mutate({ gameId }),
    })

    // Assert
    expect(firstRaceResult).toStrictEqual(ok())
    expect(secondRaceResult).toStrictEqual(expectedSecondRaceResult)
    const lobby = await creator.client.games.getDetails.query({ gameId })
    expect(lobby.status).toBe(GameStatus.READY_TO_START)
    expect(lobby.players.map(({ alias }) => alias).sort()).toStrictEqual(expectedLobbyAliases)
    expect(new Set(lobby.players.map(({ color }) => color)).size).toBe(expectedLobbyAliases.length)
  })

  concurrencyTest.for([
    {
      name: "should let a player join before the game starts",
      setup: [],
      first: "join",
      second: "start",
      expectedSecondRaceResult: ok(),
      expectedLobbyAliases: ["alice", "creator"],
    },
    {
      name: "should reject the join while the game is starting",
      setup: [],
      first: "start",
      second: "join",
      expectedSecondRaceResult: conflict("You cannot join a game that has already started."),
      expectedLobbyAliases: ["creator"],
    },
    {
      name: "should let a player leave before the game starts",
      setup: ["join"],
      first: "leave",
      second: "start",
      expectedSecondRaceResult: ok(),
      expectedLobbyAliases: ["creator"],
    },
    {
      name: "should reject the leave while the game is starting",
      setup: ["join"],
      first: "start",
      second: "leave",
      expectedSecondRaceResult: conflict("You cannot leave a game that has already started."),
      expectedLobbyAliases: ["alice", "creator"],
    },
  ] as const)("$name", async (scenario, { postgres }) => {
    // Arrange
    await using server = await ConcurrencyTestApiServer.create(postgres)
    const participants = {
      creator: await server.createClient({ authenticated: true, alias: "creator" }),
      alice: await server.createClient({ authenticated: true, alias: "alice" }),
    }

    const { createdGameId: gameId } = await participants.creator.client.games.create.mutate({
      configuration: createGameConfigurationStub({ mapGenerationSeed: 1234 }),
    })
    const operations = {
      join: { table: playersTable, command: "insert", run: async () => await participants.alice.client.games.join.mutate({ gameId }) },
      leave: { table: playersTable, command: "delete", run: async () => await participants.alice.client.games.leave.mutate({ gameId }) },
      start: {
        table: turnsTable,
        command: "insert",
        run: async () => await participants.creator.client.games.startGame.mutate({ gameId }),
      },
    } as const
    for (const operation of scenario.setup) {
      await operations[operation].run()
    }

    // Act
    const { firstRaceResult, secondRaceResult } = await runLobbyRace({
      concurrency: postgres.concurrency,
      block: operations[scenario.first],
      firstOperation: operations[scenario.first].run,
      secondOperation: operations[scenario.second].run,
    })

    // Assert
    expect(firstRaceResult).toStrictEqual(ok())
    expect(secondRaceResult).toStrictEqual(scenario.expectedSecondRaceResult)

    const lobby = await participants.creator.client.games.getDetails.query({ gameId })
    expect(lobby.status).toBe(GameStatus.IN_PROGRESS)
    expect(lobby.players.map(({ alias }) => alias).sort()).toStrictEqual(scenario.expectedLobbyAliases)
  })
})

function ok(): Success<undefined> {
  return Result.Success(undefined)
}

function conflict(message: string): Failure<unknown> {
  return Result.Failure(expect.objectContaining({ message, data: expect.objectContaining({ code: "CONFLICT" }) }))
}

/** Hold the first write until the competing operation waits for its game-row lock. */
async function runLobbyRace({
  concurrency,
  block,
  firstOperation,
  secondOperation,
}: {
  concurrency: PostgresConcurrency
  block: { table: PgTable; command: "insert" | "delete" }
  firstOperation: () => Promise<void>
  secondOperation: () => Promise<void>
}): Promise<{ firstRaceResult: Result<void, unknown>; secondRaceResult: Result<void, unknown> }> {
  await using blockedWrites = await concurrency.blockWrites(block.table)
  const first = Result.tryCatch(firstOperation())
  const firstPid = await concurrency.waitForBlockedQuery({
    blockedBy: blockedWrites.pid,
    command: block.command,
    table: block.table,
    lock: "table",
  })

  const second = Result.tryCatch(secondOperation())

  await concurrency.waitForBlockedQuery({ blockedBy: firstPid, command: "select", table: gamesTable, lock: "row" })
  await blockedWrites.release()

  const [firstRaceResult, secondRaceResult] = await Promise.all([first, second])
  return { firstRaceResult, secondRaceResult }
}
