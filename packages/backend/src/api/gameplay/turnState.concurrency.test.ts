import { sql } from "drizzle-orm"
import type { Pool, PoolClient } from "pg"
import { createGameConfigurationStub } from "shared/domain/games/GameConfiguration.stub.ts"
import { describe, expect, it, onTestFinished } from "vitest"
import { createApiStub } from "#api/createApi.stub.ts"
import { createDb } from "#lib/db/createDb.ts"
import { ApiServer } from "#testing/ApiServer.ts"
import { createConcurrencyTestDb } from "#testing/createConcurrencyTestDb.ts"
import { createPostgresPoolDisposal } from "#testing/createPostgresPoolDisposal.ts"
import { subscribeToTurnState } from "#testing/readTurnState.ts"

describe("Turn State notifications", () => {
  it("should recover a readiness change missed by both open streams while the PostgreSQL listener is disconnected", async () => {
    // Arrange
    await using postgres = await createConcurrencyTestDb()
    const { db } = postgres
    using server = new ApiServer(await createApiStub({ db }))
    const alice = await server.createClient({ authenticated: true })
    const bob = await server.createClient({ authenticated: true })
    const { createdGameId: gameId } = await alice.client.games.create.mutate({ configuration: createGameConfigurationStub() })
    await bob.client.games.join.mutate({ gameId })
    await alice.client.games.startGame.mutate({ gameId })

    using aliceStream = subscribeToTurnState(alice.client, gameId)
    using bobStream = subscribeToTurnState(bob.client, gameId)
    const initial = await aliceStream.next()
    expect(await bobStream.next()).toStrictEqual(initial)
    await bob.client.gameplay.updateReadiness.mutate({ gameId, turn: 1, isReady: true })
    const bobReady = { ...initial, readinessByPlayerId: { [alice.account.id]: false, [bob.account.id]: true } }
    await expect.poll(aliceStream.next).toStrictEqual(bobReady)
    await expect.poll(bobStream.next).toStrictEqual(bobReady)

    const databaseName = sql.identifier(new URL(postgres.databaseUrl).pathname.slice(1))
    const admin = createDb({ databaseUrl: new URL("/postgres", postgres.databaseUrl).href })
    onTestFinished(createPostgresPoolDisposal(admin.$client))
    using writer = await connect(db.$client)

    // Act
    await admin.execute(sql`ALTER DATABASE ${databaseName} ALLOW_CONNECTIONS false`)
    const killed = await writer.query<{ disconnected: boolean }>(
      "SELECT pg_terminate_backend(pid, 5000) AS disconnected FROM pg_stat_activity WHERE datname = current_database() AND application_name = 'turn-state-listener'",
    )
    expect(killed.rows).toStrictEqual([{ disconnected: true }])
    await writer.query("UPDATE players SET is_ready = false WHERE game_id = $1 AND player_id = $2", [gameId, bob.account.id])
    await admin.execute(sql`ALTER DATABASE ${databaseName} ALLOW_CONNECTIONS true`)

    // Assert
    await expect.poll(aliceStream.next, { timeout: 5_000 }).toStrictEqual(initial)
    await expect.poll(bobStream.next, { timeout: 5_000 }).toStrictEqual(initial)

    await alice.client.gameplay.updateReadiness.mutate({ gameId, turn: 1, isReady: true })
    const aliceReady = { ...initial, readinessByPlayerId: { [alice.account.id]: true, [bob.account.id]: false } }
    await expect.poll(aliceStream.next).toStrictEqual(aliceReady)
    await expect.poll(bobStream.next).toStrictEqual(aliceReady)
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
