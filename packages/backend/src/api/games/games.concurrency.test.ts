import { Result } from "@guillaume-docquier/tools-ts"
import type { PgTable } from "drizzle-orm/pg-core"
import { createGameConfigurationStub } from "shared/domain/games/GameConfiguration.stub.ts"
import type { GameId } from "shared/domain/games/GameId.ts"
import { GameStatus } from "shared/domain/games/GameStatus.ts"
import { PlayerColor } from "shared/domain/players/PlayerColor.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import { describe, expect } from "vitest"
import { createPlayerViewResourcesStub } from "#api/gameplay/PlayerViewResources.stub.ts"
import { gamesTable, playersTable, turnsTable } from "#lib/db/schema.ts"
import type { AuthenticatedApiClient } from "#tests/ApiClient.ts"
import { ConcurrencyTestApiServer } from "#tests/ConcurrencyTestApiServer.ts"
import type { PostgresConcurrency } from "#tests/PostgresConcurrency.ts"
import { concurrencyTest } from "#tests/vitest.concurrency.fixture.ts"

describe("lobby concurrency", () => {
  concurrencyTest("two joins competing for the last seat return success and lobby full", async ({ postgres }) => {
    // Arrange
    await using server = await ConcurrencyTestApiServer.create(postgres)
    const creator = await server.createClient({ authenticated: true })
    const alice = await server.createClient({ authenticated: true })
    const bob = await server.createClient({ authenticated: true })

    const { createdGameId: gameId } = await creator.client.games.create.mutate({
      configuration: createGameConfigurationStub({ nbSeats: 2, mapGenerationSeed: 1234 }),
    })

    // Act
    const [first, second] = await runLobbyRace(
      postgres.concurrency,
      { table: playersTable, command: "insert", run: async () => await alice.client.games.join.mutate({ gameId }) },
      async () => await bob.client.games.join.mutate({ gameId }),
    )

    // Assert
    expect(first).toStrictEqual(Result.Success(undefined))
    expect(second).toStrictEqual(
      Result.Failure(
        expect.objectContaining({
          message: "The lobby is full.",
          data: expect.objectContaining({ code: "CONFLICT" }),
        }),
      ),
    )
    const lobby = await creator.client.games.getDetails.query({ gameId })
    expect(lobby.status).toBe(GameStatus.READY_TO_START)
    expect(lobby.players.map(({ alias }) => alias).sort()).toStrictEqual([creator.account.alias, alice.account.alias].sort())
  })

  concurrencyTest("two joins with available seats both succeed with distinct colors", async ({ postgres }) => {
    // Arrange
    await using server = await ConcurrencyTestApiServer.create(postgres)
    const creator = await server.createClient({ authenticated: true })
    const alice = await server.createClient({ authenticated: true })
    const bob = await server.createClient({ authenticated: true })

    const { createdGameId: gameId } = await creator.client.games.create.mutate({
      configuration: createGameConfigurationStub({ nbSeats: 3, mapGenerationSeed: 1234 }),
    })

    // Act
    const [first, second] = await runLobbyRace(
      postgres.concurrency,
      { table: playersTable, command: "insert", run: async () => await alice.client.games.join.mutate({ gameId }) },
      async () => await bob.client.games.join.mutate({ gameId }),
    )

    // Assert
    expect(first).toStrictEqual(Result.Success(undefined))
    expect(second).toStrictEqual(Result.Success(undefined))
    const lobby = await creator.client.games.getDetails.query({ gameId })
    expect(lobby.status).toBe(GameStatus.READY_TO_START)
    expect(lobby.players.map(({ alias, color }) => ({ alias, color })).sort((a, b) => a.alias.localeCompare(b.alias))).toStrictEqual(
      [
        { alias: creator.account.alias, color: PlayerColor.TURQUOISE },
        { alias: alice.account.alias, color: PlayerColor.PINK },
        { alias: bob.account.alias, color: PlayerColor.YELLOW },
      ].sort((a, b) => a.alias.localeCompare(b.alias)),
    )
  })

  concurrencyTest.for([
    {
      name: "join before start includes the joining player in the initialized game",
      aliceAlreadyJoined: false,
      first: "join",
      second: "start",
      firstWrite: { table: playersTable, command: "insert" },
      expectedSecond: Result.Success(undefined),
      expectedPlayers: ["creator", "alice"],
    },
    {
      name: "start before join rejects the join and initializes only existing players",
      aliceAlreadyJoined: false,
      first: "start",
      second: "join",
      firstWrite: { table: turnsTable, command: "insert" },
      expectedSecond: Result.Failure(
        expect.objectContaining({
          message: "You cannot join a game that has already started.",
          data: expect.objectContaining({ code: "CONFLICT" }),
        }),
      ),
      expectedPlayers: ["creator"],
    },
    {
      name: "leave before start excludes the departing player from the initialized game",
      aliceAlreadyJoined: true,
      first: "leave",
      second: "start",
      firstWrite: { table: playersTable, command: "delete" },
      expectedSecond: Result.Success(undefined),
      expectedPlayers: ["creator"],
    },
    {
      name: "start before leave rejects the leave and initializes all existing players",
      aliceAlreadyJoined: true,
      first: "start",
      second: "leave",
      firstWrite: { table: turnsTable, command: "insert" },
      expectedSecond: Result.Failure(
        expect.objectContaining({
          message: "You cannot leave a game that has already started.",
          data: expect.objectContaining({ code: "CONFLICT" }),
        }),
      ),
      expectedPlayers: ["creator", "alice"],
    },
  ] as const)("$name", async (scenario, { postgres }) => {
    // Arrange
    await using server = await ConcurrencyTestApiServer.create(postgres)
    const participants = {
      creator: await server.createClient({ authenticated: true }),
      alice: await server.createClient({ authenticated: true }),
    }

    const { createdGameId: gameId } = await participants.creator.client.games.create.mutate({
      configuration: createGameConfigurationStub({ mapGenerationSeed: 1234 }),
    })
    if (scenario.aliceAlreadyJoined) {
      await participants.alice.client.games.join.mutate({ gameId })
    }
    const operations = {
      join: async (): Promise<void> => await participants.alice.client.games.join.mutate({ gameId }),
      leave: async (): Promise<void> => await participants.alice.client.games.leave.mutate({ gameId }),
      start: async (): Promise<void> => await participants.creator.client.games.startGame.mutate({ gameId }),
    }

    // Act
    const [first, second] = await runLobbyRace(
      postgres.concurrency,
      { ...scenario.firstWrite, run: operations[scenario.first] },
      operations[scenario.second],
    )

    // Assert
    expect(first).toStrictEqual(Result.Success(undefined))
    expect(second).toStrictEqual(scenario.expectedSecond)
    await expectStartedPlayers(
      participants.creator,
      gameId,
      scenario.expectedPlayers.map((name) => participants[name]),
    )
  })
})

/** Hold the first write until the competing operation waits for its game-row lock. */
async function runLobbyRace(
  concurrency: PostgresConcurrency,
  firstOperation: { table: PgTable; command: "insert" | "delete"; run: () => Promise<void> },
  secondOperation: () => Promise<void>,
): Promise<[Result<void, unknown>, Result<void, unknown>]> {
  await using block = await concurrency.blockWrites(firstOperation.table)
  const first = Result.tryCatch(firstOperation.run())
  const firstPid = await concurrency.waitForBlockedQuery({
    blockedBy: block.pid,
    command: firstOperation.command,
    table: firstOperation.table,
    lock: "table",
  })
  const second = Result.tryCatch(secondOperation())
  await concurrency.waitForBlockedQuery({ blockedBy: firstPid, command: "select", table: gamesTable, lock: "row" })
  await block.release()
  return await Promise.all([first, second])
}

async function expectStartedPlayers(
  creator: AuthenticatedApiClient,
  gameId: GameId,
  participants: readonly AuthenticatedApiClient[],
): Promise<void> {
  const lobby = await creator.client.games.getDetails.query({ gameId })
  expect(lobby.status).toBe(GameStatus.IN_PROGRESS)
  expect(lobby.players.map(({ alias }) => alias).sort()).toStrictEqual(participants.map(({ account }) => account.alias).sort())
  for (const participant of participants) {
    const view = await participant.client.gameplay.getPlayerView.query({ gameId })
    expect(view.turn).toBe(1)
    expect(view.resources).toStrictEqual(
      createPlayerViewResourcesStub({
        [ResourceType.INFLUENCE]: { uncommitted: 3, total: 3 },
        [ResourceType.METAL]: { uncommitted: 2, total: 2 },
        [ResourceType.FUEL]: { uncommitted: 1, total: 1 },
      }),
    )
    expect([view.player.id, ...Object.keys(view.opponents)].sort()).toStrictEqual(participants.map(({ account }) => account.id).sort())
    const planetOwners = view.galaxy.systems
      .flatMap(({ planets }) => planets.map(({ ownerPlayerId }) => ownerPlayerId))
      .filter((owner) => owner !== null)
    expect(planetOwners.sort()).toStrictEqual(participants.map(({ account }) => account.id).sort())
  }
}
