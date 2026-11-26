import type { Pool, PoolClient } from "pg"
import { createGameConfigurationStub } from "shared/domain/games/GameConfiguration.stub.ts"
import { describe, expect, it } from "vitest"
import { createApiStub } from "#api/createApi.stub.ts"
import { ApiServer } from "#testing/ApiServer.ts"
import { createConcurrencyTestDb } from "#testing/createConcurrencyTestDb.ts"
import { subscribeToTurnState } from "#testing/readTurnState.ts"

describe("Turn State notifications", () => {
  it("should restore an open stream after PostgreSQL disconnects the notification listener", async () => {
    // Arrange
    await using postgres = await createConcurrencyTestDb()
    const { db } = postgres
    using server = new ApiServer(await createApiStub({ db }))
    const alice = await server.createClient({ authenticated: true })
    const bob = await server.createClient({ authenticated: true })
    const { createdGameId: gameId } = await alice.client.games.create.mutate({ configuration: createGameConfigurationStub() })
    await bob.client.games.join.mutate({ gameId })
    await alice.client.games.startGame.mutate({ gameId })
    using stream = subscribeToTurnState(bob.client, gameId)
    const initial = await stream.next()

    // Act
    const killed = await db.$client.query<{ disconnected: boolean }>(
      "SELECT pg_terminate_backend(pid, 5000) AS disconnected FROM pg_stat_activity WHERE datname = current_database() AND application_name = 'turn-state-listener'",
    )

    // Assert
    expect(killed.rows).toStrictEqual([{ disconnected: true }])
    expect(await stream.next()).toStrictEqual(initial)
    await alice.client.gameplay.updateReadiness.mutate({ gameId, turn: 1, isReady: true })
    expect(await stream.next()).toStrictEqual({ ...initial, readinessByPlayerId: { [alice.account.id]: true, [bob.account.id]: false } })
    await alice.client.gameplay.updateReadiness.mutate({ gameId, turn: 1, isReady: false })
    expect(await stream.next()).toStrictEqual(initial)
  })

  it("should deliver one game ID for committed changes and skips rolled-back and unchanged writes", async () => {
    // Arrange
    await using postgres = await createConcurrencyTestDb()
    const { db } = postgres
    using server = new ApiServer(await createApiStub({ db }))
    const player = await server.createClient({ authenticated: true })
    const { createdGameId: gameId } = await player.client.games.create.mutate({ configuration: createGameConfigurationStub() })
    await player.client.games.startGame.mutate({ gameId })
    using observer = await connect(db.$client)
    using writer = await connect(db.$client)
    const received = collectNotifications(observer)
    await observer.query("LISTEN turn_state_changed")

    // Act
    await writer.query("BEGIN")
    await writer.query("UPDATE players SET is_ready = true WHERE game_id = $1", [gameId])
    await writer.query("ROLLBACK")
    await writer.query("UPDATE players SET is_ready = is_ready WHERE game_id = $1", [gameId])
    await writer.query("UPDATE turns SET ends_at = ends_at, status = status WHERE game_id = $1", [gameId])
    await writer.query("BEGIN")
    await writer.query("UPDATE players SET is_ready = true WHERE game_id = $1", [gameId])
    await writer.query("UPDATE turns SET ends_at = ends_at + interval '1 hour' WHERE game_id = $1", [gameId])
    await writer.query("COMMIT")
    await writer.query("NOTIFY turn_state_changed, 'complete'")
    const delivered = await received

    // Assert
    expect(delivered).toStrictEqual([String(gameId)])
  })
})

async function connect(pool: Pool): Promise<PoolClient & Disposable> {
  const client = await pool.connect()
  return Object.assign(client, {
    [Symbol.dispose]: () => {
      client.release(true)
    },
  })
}

async function collectNotifications(observer: PoolClient): Promise<string[]> {
  const delivered: string[] = []
  const completed = Promise.withResolvers<string[]>()
  observer.on("notification", ({ payload }) => {
    if (payload === "complete") {
      completed.resolve(delivered)
    } else if (payload !== undefined) {
      delivered.push(payload)
    }
  })
  return await completed.promise
}
