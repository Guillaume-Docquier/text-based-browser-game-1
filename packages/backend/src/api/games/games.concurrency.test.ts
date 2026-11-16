import { Result } from "@guillaume-docquier/tools-ts"
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
import { concurrencyTest as baseTest } from "#tests/vitest.concurrency.fixture.ts"

const concurrencyTest = baseTest.extend("participants", async ({ postgresDatabase }, { onCleanup }) => {
  const server = await ConcurrencyTestApiServer.create(postgresDatabase)
  onCleanup(async () => {
    await server[Symbol.asyncDispose]()
  })
  const creator = await server.createClient({ authenticated: true })
  const alice = await server.createClient({ authenticated: true })
  const bob = await server.createClient({ authenticated: true })
  return { creator, alice, bob }
})

describe("lobby concurrency", () => {
  concurrencyTest(
    "two joins competing for the last seat return success and lobby full",
    async ({ postgresDatabase: { concurrency }, participants: { creator, alice, bob } }) => {
      // Arrange
      const { createdGameId: gameId } = await creator.client.games.create.mutate({
        configuration: createGameConfigurationStub({ nbSeats: 2, mapGenerationSeed: 1234 }),
      })
      await using block = await concurrency.blockWrites(playersTable)

      // Act
      const first = Result.tryCatch(alice.client.games.join.mutate({ gameId }))
      const firstPid = await concurrency.waitForBlockedQuery({
        blockedBy: block.pid,
        command: "insert",
        table: playersTable,
        lock: "table",
      })
      const second = Result.tryCatch(bob.client.games.join.mutate({ gameId }))
      await concurrency.waitForBlockedQuery({ blockedBy: firstPid, command: "select", table: gamesTable, lock: "row" })
      await block.release()

      // Assert
      expect(await first).toStrictEqual(Result.Success(undefined))
      expect(await second).toStrictEqual(
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
    },
  )

  concurrencyTest(
    "two joins with available seats both succeed with distinct colors",
    async ({ postgresDatabase: { concurrency }, participants: { creator, alice, bob } }) => {
      // Arrange
      const { createdGameId: gameId } = await creator.client.games.create.mutate({
        configuration: createGameConfigurationStub({ nbSeats: 3, mapGenerationSeed: 1234 }),
      })
      await using block = await concurrency.blockWrites(playersTable)

      // Act
      const first = Result.tryCatch(alice.client.games.join.mutate({ gameId }))
      const firstPid = await concurrency.waitForBlockedQuery({
        blockedBy: block.pid,
        command: "insert",
        table: playersTable,
        lock: "table",
      })
      const second = Result.tryCatch(bob.client.games.join.mutate({ gameId }))
      await concurrency.waitForBlockedQuery({ blockedBy: firstPid, command: "select", table: gamesTable, lock: "row" })
      await block.release()

      // Assert
      expect(await first).toStrictEqual(Result.Success(undefined))
      expect(await second).toStrictEqual(Result.Success(undefined))
      const lobby = await creator.client.games.getDetails.query({ gameId })
      expect(lobby.status).toBe(GameStatus.READY_TO_START)
      expect(lobby.players.map(({ alias, color }) => ({ alias, color })).sort((a, b) => a.alias.localeCompare(b.alias))).toStrictEqual(
        [
          { alias: creator.account.alias, color: PlayerColor.TURQUOISE },
          { alias: alice.account.alias, color: PlayerColor.PINK },
          { alias: bob.account.alias, color: PlayerColor.YELLOW },
        ].sort((a, b) => a.alias.localeCompare(b.alias)),
      )
    },
  )

  concurrencyTest(
    "join before start includes the joining player in the initialized game",
    async ({ postgresDatabase: { concurrency }, participants: { creator, alice } }) => {
      // Arrange
      const { createdGameId: gameId } = await creator.client.games.create.mutate({
        configuration: createGameConfigurationStub({ mapGenerationSeed: 1234 }),
      })
      await using block = await concurrency.blockWrites(playersTable)

      // Act
      const first = Result.tryCatch(alice.client.games.join.mutate({ gameId }))
      const firstPid = await concurrency.waitForBlockedQuery({
        blockedBy: block.pid,
        command: "insert",
        table: playersTable,
        lock: "table",
      })
      const second = Result.tryCatch(creator.client.games.startGame.mutate({ gameId }))
      await concurrency.waitForBlockedQuery({ blockedBy: firstPid, command: "select", table: gamesTable, lock: "row" })
      await block.release()

      // Assert
      expect(await first).toStrictEqual(Result.Success(undefined))
      expect(await second).toStrictEqual(Result.Success(undefined))
      await expectStartedPlayers(creator, gameId, [creator, alice])
    },
  )

  concurrencyTest(
    "start before join rejects the join and initializes only existing players",
    async ({ postgresDatabase: { concurrency }, participants: { creator, alice } }) => {
      // Arrange
      const { createdGameId: gameId } = await creator.client.games.create.mutate({
        configuration: createGameConfigurationStub({ mapGenerationSeed: 1234 }),
      })
      await using block = await concurrency.blockWrites(turnsTable)

      // Act
      const first = Result.tryCatch(creator.client.games.startGame.mutate({ gameId }))
      const firstPid = await concurrency.waitForBlockedQuery({ blockedBy: block.pid, command: "insert", table: turnsTable, lock: "table" })
      const second = Result.tryCatch(alice.client.games.join.mutate({ gameId }))
      await concurrency.waitForBlockedQuery({ blockedBy: firstPid, command: "select", table: gamesTable, lock: "row" })
      await block.release()

      // Assert
      expect(await first).toStrictEqual(Result.Success(undefined))
      expect(await second).toStrictEqual(
        Result.Failure(
          expect.objectContaining({
            message: "You cannot join a game that has already started.",
            data: expect.objectContaining({ code: "CONFLICT" }),
          }),
        ),
      )
      await expectStartedPlayers(creator, gameId, [creator])
    },
  )

  concurrencyTest(
    "leave before start excludes the departing player from the initialized game",
    async ({ postgresDatabase: { concurrency }, participants: { creator, alice } }) => {
      // Arrange
      const { createdGameId: gameId } = await creator.client.games.create.mutate({
        configuration: createGameConfigurationStub({ mapGenerationSeed: 1234 }),
      })
      await alice.client.games.join.mutate({ gameId })
      await using block = await concurrency.blockWrites(playersTable)

      // Act
      const first = Result.tryCatch(alice.client.games.leave.mutate({ gameId }))
      const firstPid = await concurrency.waitForBlockedQuery({
        blockedBy: block.pid,
        command: "delete",
        table: playersTable,
        lock: "table",
      })
      const second = Result.tryCatch(creator.client.games.startGame.mutate({ gameId }))
      await concurrency.waitForBlockedQuery({ blockedBy: firstPid, command: "select", table: gamesTable, lock: "row" })
      await block.release()

      // Assert
      expect(await first).toStrictEqual(Result.Success(undefined))
      expect(await second).toStrictEqual(Result.Success(undefined))
      await expectStartedPlayers(creator, gameId, [creator])
    },
  )

  concurrencyTest(
    "start before leave rejects the leave and initializes all existing players",
    async ({ postgresDatabase: { concurrency }, participants: { creator, alice } }) => {
      // Arrange
      const { createdGameId: gameId } = await creator.client.games.create.mutate({
        configuration: createGameConfigurationStub({ mapGenerationSeed: 1234 }),
      })
      await alice.client.games.join.mutate({ gameId })
      await using block = await concurrency.blockWrites(turnsTable)

      // Act
      const first = Result.tryCatch(creator.client.games.startGame.mutate({ gameId }))
      const firstPid = await concurrency.waitForBlockedQuery({ blockedBy: block.pid, command: "insert", table: turnsTable, lock: "table" })
      const second = Result.tryCatch(alice.client.games.leave.mutate({ gameId }))
      await concurrency.waitForBlockedQuery({ blockedBy: firstPid, command: "select", table: gamesTable, lock: "row" })
      await block.release()

      // Assert
      expect(await first).toStrictEqual(Result.Success(undefined))
      expect(await second).toStrictEqual(
        Result.Failure(
          expect.objectContaining({
            message: "You cannot leave a game that has already started.",
            data: expect.objectContaining({ code: "CONFLICT" }),
          }),
        ),
      )
      await expectStartedPlayers(creator, gameId, [creator, alice])
    },
  )
})

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
