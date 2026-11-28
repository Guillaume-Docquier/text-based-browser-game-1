import { readFile } from "node:fs/promises"
import { Assert } from "@guillaume-docquier/tools-ts"
import { createGameConfigurationStub } from "shared/domain/games/GameConfiguration.stub.ts"
import { describe, expect, it } from "vitest"
import { shipsTable } from "#lib/db/schema.ts"
import { ConcurrencyTestApiServer } from "#testing/ConcurrencyTestApiServer.ts"
import { createConcurrencyTestDb } from "#testing/createConcurrencyTestDb.ts"

describe("starting transport migration", () => {
  it("should meet DB-0003 When a match predating ships is upgraded, create the missing starting transport once for each participant with a saved home. Later reads and restarts retain the same ship identity, owner and location.", async () => {
    // Arrange
    await using postgres = await createConcurrencyTestDb()
    await using server = await ConcurrencyTestApiServer.create(postgres)
    const alice = await server.createClient({ authenticated: true })
    const bob = await server.createClient({ authenticated: true })
    const configuration = createGameConfigurationStub({ nbSeats: 2, mapGenerationSeed: 1234 })
    const { createdGameId: gameId } = await alice.client.games.create.mutate({ configuration })
    const { createdGameId: other } = await alice.client.games.create.mutate({ configuration })
    await bob.client.games.join.mutate({ gameId })
    await alice.client.games.startGame.mutate({ gameId })
    await alice.client.games.startGame.mutate({ gameId: other })
    const initial = await alice.client.gameplay.getPlayerView.query({ gameId })
    const otherFleet = (await alice.client.gameplay.getPlayerView.query({ gameId: other })).ships
    const aliceShip = initial.ships.find((ship) => ship.ownerPlayerId === initial.player.id)
    const bobShip = initial.ships.find((ship) => ship.ownerPlayerId !== initial.player.id)
    Assert.isDefined(aliceShip)
    Assert.isDefined(bobShip)
    const destination = initial.galaxy.systems.flatMap((system) => system.planets).find((planet) => planet.ownerPlayerId === null)
    Assert.isDefined(destination)
    const sql = await readFile(new URL("../../../migrations/0005_backfill-starting-transports.sql", import.meta.url), "utf8")
    const pool = postgres.db.$client
    await pool.query("DELETE FROM ships WHERE game_id = $1", [gameId])
    const writer = await pool.connect()
    using _connection = {
      [Symbol.dispose](): void {
        writer.release(true)
      },
    }
    const {
      rows: [session],
    } = await writer.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")
    Assert.isDefined(session)

    // Act
    await writer.query("BEGIN")
    await writer.query("INSERT INTO ships (game_id,id,type,owner_player_id,planet_id) VALUES ($1,$2,$3,$4,$5)", [
      gameId,
      aliceShip.id,
      aliceShip.type,
      aliceShip.ownerPlayerId,
      destination.id,
    ])
    const upgrading = pool.query(sql)
    await postgres.concurrency.waitForBlockedQuery({ blockedBy: session.pid, command: "insert", table: shipsTable, lock: "row" })
    await writer.query("COMMIT")
    const upgraded = await upgrading
    const replay = await pool.query(sql)
    const reopened = await bob.client.gameplay.getPlayerView.query({ gameId })

    // Assert
    expect(upgraded.rowCount).toBe(1)
    expect(replay.rowCount).toBe(0)
    expect(reopened.ships).toHaveLength(2)
    expect(reopened.ships).toStrictEqual(expect.arrayContaining([{ ...aliceShip, planetId: destination.id }, bobShip]))
    expect((await alice.client.gameplay.getPlayerView.query({ gameId: other })).ships).toStrictEqual(otherFleet)
  })
})
