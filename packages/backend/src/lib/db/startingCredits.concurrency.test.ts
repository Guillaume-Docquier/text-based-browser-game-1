import { readFile } from "node:fs/promises"
import { Assert } from "@guillaume-docquier/tools-ts"
import { createGameConfigurationStub } from "shared/domain/games/GameConfiguration.stub.ts"
import { describe, expect, it } from "vitest"
import { playersTable } from "#lib/db/schema.ts"
import { ConcurrencyTestApiServer } from "#testing/ConcurrencyTestApiServer.ts"
import { createConcurrencyTestDb } from "#testing/createConcurrencyTestDb.ts"

describe("participant credit migration", () => {
  it("should meet DB-0002 When an existing match gains credit balances, each participant missing a balance receives the starting grant once. Reopening the match or restarting the backend preserves the stored amount.", async () => {
    // Arrange
    await using postgres = await createConcurrencyTestDb()
    await using server = await ConcurrencyTestApiServer.create(postgres)
    const alice = await server.createClient({ authenticated: true, alias: "alice" })
    const bob = await server.createClient({ authenticated: true, alias: "bob" })
    const configuration = createGameConfigurationStub({ nbSeats: 2, mapGenerationSeed: 1234 })
    const { createdGameId: first } = await alice.client.games.create.mutate({ configuration })
    const { createdGameId: second } = await alice.client.games.create.mutate({ configuration })
    const { createdGameId: waiting } = await bob.client.games.create.mutate({ configuration })
    await bob.client.games.join.mutate({ gameId: first })
    await alice.client.games.startGame.mutate({ gameId: first })
    await alice.client.games.startGame.mutate({ gameId: second })
    const pool = postgres.db.$client
    const setBalance = "UPDATE players SET credit_balance = $1 WHERE game_id = $2 AND player_id = $3"
    await pool.query(setBalance, [0, first, alice.account.id])
    await pool.query(setBalance, [null, first, bob.account.id])
    await pool.query(setBalance, [17.25, second, alice.account.id])
    const backfill = await readFile(new URL("../../../migrations/0003_backfill-starting-credits.sql", import.meta.url), "utf8")

    // Act
    await pool.query(backfill)
    const granted = await bob.client.gameplay.getPlayerView.query({ gameId: first })
    await pool.query(setBalance, [null, first, bob.account.id])
    const writer = await pool.connect()
    using _connection = {
      [Symbol.dispose](): void {
        writer.release(true)
      },
    }
    const {
      rows: [writerSession],
    } = await writer.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")
    Assert.isDefined(writerSession)
    await writer.query("BEGIN")
    await writer.query(setBalance, [28.5, first, bob.account.id])
    const replay = pool.query(backfill)
    await postgres.concurrency.waitForBlockedQuery({ blockedBy: writerSession.pid, command: "update", table: playersTable, lock: "row" })
    await writer.query("COMMIT")
    const replayed = await replay
    const aliceFirst = await alice.client.gameplay.getPlayerView.query({ gameId: first })
    const bobFirst = await bob.client.gameplay.getPlayerView.query({ gameId: first })
    const aliceSecond = await alice.client.gameplay.getPlayerView.query({ gameId: second })
    const pending = await pool.query("SELECT credit_balance FROM players WHERE game_id = $1", [waiting])
    await bob.client.games.startGame.mutate({ gameId: waiting })
    const newlyStarted = await bob.client.gameplay.getPlayerView.query({ gameId: waiting })

    // Assert
    expect(granted.player.creditBalance).toBe(100)
    expect(replayed.rowCount).toBe(0)
    expect([aliceFirst.player.creditBalance, bobFirst.player.creditBalance, aliceSecond.player.creditBalance]).toStrictEqual([
      0, 28.5, 17.25,
    ])
    expect(Object.values(aliceFirst.opponents)).toStrictEqual([{ id: bobFirst.player.id, color: bobFirst.player.color }])
    expect(Object.values(bobFirst.opponents)).toStrictEqual([{ id: aliceFirst.player.id, color: aliceFirst.player.color }])
    expect(pending.rows).toStrictEqual([{ credit_balance: null }])
    expect(newlyStarted.player.creditBalance).toBe(100)
  })
})
