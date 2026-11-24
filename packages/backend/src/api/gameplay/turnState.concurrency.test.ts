import { Assert, branded, Logger } from "@guillaume-docquier/tools-ts"
import { eq, sql } from "drizzle-orm"
import { Client } from "pg"
import { createGameConfigurationStub } from "shared/domain/games/GameConfiguration.stub.ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import { TurnStatus } from "shared/domain/turns/TurnStatus.ts"
import { describe, expect, it } from "vitest"
import { createApiStub } from "#api/createApi.stub.ts"
import type { TurnState } from "#api/types.ts"
import { playersTable } from "#lib/db/schema.ts"
import { TurnStateListener } from "#lib/db/TurnStateListener.ts"
import { ApiServer } from "#testing/ApiServer.ts"
import { createConcurrencyTestDb } from "#testing/createConcurrencyTestDb.ts"

describe("turn-state notifications", () => {
  it("should send database notifications only for committed turn-state changes", async () => {
    // Arrange
    await using postgres = await createConcurrencyTestDb()
    const { db } = postgres
    using server = new ApiServer(await createApiStub({ db }))
    const alice = await server.createClient({ authenticated: true })
    const bob = await server.createClient({ authenticated: true })
    const { createdGameId: gameId } = await alice.client.games.create.mutate({
      configuration: createGameConfigurationStub({ nbSeats: 2 }),
    })
    await bob.client.games.join.mutate({ gameId })

    const observer = new Client({ connectionString: postgres.databaseUrl })
    await observer.connect()
    await using _cleanup = {
      [Symbol.asyncDispose]: async (): Promise<void> => {
        await observer.end()
      },
    }
    const payloads: Array<string | undefined> = []
    observer.on("notification", ({ payload }) => {
      payloads.push(payload)
    })
    await observer.query("LISTEN turn_state_changed")

    // Act
    await alice.client.games.startGame.mutate({ gameId })
    await alice.client.gameplay.updateReadiness.mutate({ gameId, turn: 1, isReady: true })
    await alice.client.gameplay.updateReadiness.mutate({ gameId, turn: 1, isReady: true })

    const rollback = new Error("Roll back readiness change")
    await expect(
      db.transaction(async (tx) => {
        await tx.update(playersTable).set({ isReady: false }).where(eq(playersTable.gameId, gameId))
        throw rollback
      }),
    ).rejects.toBe(rollback)

    await bob.client.gameplay.updateReadiness.mutate({ gameId, turn: 1, isReady: true })
    await observer.query("SELECT pg_notify('turn_state_changed', 'barrier')")
    // Assert
    await expect.poll(() => payloads).toContain("barrier")
    expect(payloads).toStrictEqual([String(gameId), String(gameId), String(gameId), "barrier"])
  })

  it("should refresh an open subscription after reconnecting its database listener", async () => {
    // Arrange
    await using postgres = await createConcurrencyTestDb()
    const { db, databaseUrl } = postgres
    const api = await createApiStub({ db })
    using server = new ApiServer(api)
    const alice = await server.createClient({ authenticated: true })
    const bob = await server.createClient({ authenticated: true })
    const { createdGameId: gameId } = await alice.client.games.create.mutate({
      configuration: createGameConfigurationStub({ nbSeats: 2 }),
    })
    await bob.client.games.join.mutate({ gameId })
    await alice.client.games.startGame.mutate({ gameId })

    const listener = new TurnStateListener({ databaseUrl, logger: Logger.get() })
    const lifetime = new AbortController()
    const listening = Promise.withResolvers<undefined>()
    const run = listener.listen({
      signal: lifetime.signal,
      onListening: () => {
        api.turnStateUseCase.refreshAll()
        listening.resolve(undefined)
      },
      onChange: (id) => {
        api.turnStateUseCase.refresh(id)
      },
    })
    await using _listenerCleanup = {
      [Symbol.asyncDispose]: async (): Promise<void> => {
        lifetime.abort()
        await run
      },
    }
    await listening.promise

    const initial = Promise.withResolvers<TurnState>()
    const received: Array<TurnState | Error> = []
    const subscription = bob.client.gameplay.turnState.subscribe(
      { gameId },
      {
        onData: (snapshot) => {
          initial.resolve(snapshot)
          received.push(snapshot)
        },
        onError: (error) => {
          initial.reject(error)
          received.push(error)
        },
      },
    )
    using _subscriptionCleanup = {
      [Symbol.dispose]: (): void => {
        subscription.unsubscribe()
      },
    }
    const initialSnapshot = await initial.promise

    // Act
    const { rows } = await db.execute<{ pid: number }>(
      sql`SELECT pid FROM pg_stat_activity WHERE datname = current_database() AND application_name = 'turn-state-listener'`,
    )
    const listenerSession = rows[0]
    Assert.isDefined(listenerSession)
    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_terminate_backend(${listenerSession.pid}, 5000)`)
      await tx
        .update(playersTable)
        .set({ isReady: true })
        .where(eq(playersTable.playerId, branded<PlayerId>(alice.account.id)))
    })

    // Assert
    expect(initialSnapshot.readinessByPlayerId).toStrictEqual({ [alice.account.id]: false, [bob.account.id]: false })
    await expect
      .poll(() => received[1])
      .toStrictEqual({
        ...initialSnapshot,
        turn: 1,
        turnStatus: TurnStatus.COLLECTING_ACTIONS,
        readinessByPlayerId: { [alice.account.id]: true, [bob.account.id]: false },
      })
  })
})
