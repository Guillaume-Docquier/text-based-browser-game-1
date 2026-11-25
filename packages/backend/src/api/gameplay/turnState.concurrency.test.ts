import { eq } from "drizzle-orm"
import { createGameConfigurationStub } from "shared/domain/games/GameConfiguration.stub.ts"
import { TurnStatus } from "shared/domain/turns/TurnStatus.ts"
import { describe, expect, it, onTestFinished } from "vitest"
import type { TurnState } from "#api/types.ts"
import { playersTable } from "#lib/db/schema.ts"
import { ConcurrencyTestApiServer } from "#testing/ConcurrencyTestApiServer.ts"
import { createConcurrencyTestDb } from "#testing/createConcurrencyTestDb.ts"

describe("gameplay.turnState on PostgreSQL", () => {
  it("should refresh open streams after the database listener reconnects", async () => {
    // Arrange
    const postgres = await createConcurrencyTestDb()
    onTestFinished(async () => {
      await postgres[Symbol.asyncDispose]()
    })
    const api = await ConcurrencyTestApiServer.create(postgres)
    onTestFinished(async () => {
      await api[Symbol.asyncDispose]()
    })
    const creator = await api.createClient({ authenticated: true })
    const opponent = await api.createClient({ authenticated: true })
    const configuration = createGameConfigurationStub({ nbSeats: 2, turnIntervalSeconds: 3600 })
    const { createdGameId: gameId } = await creator.client.games.create.mutate({ configuration })
    await opponent.client.games.join.mutate({ gameId })
    await creator.client.games.startGame.mutate({ gameId })

    const creatorStates: TurnState[] = []
    const opponentStates: TurnState[] = []
    const creatorSubscription = creator.client.gameplay.turnState.subscribe(
      { gameId },
      { onData: (snapshot) => creatorStates.push(snapshot) },
    )
    const opponentSubscription = opponent.client.gameplay.turnState.subscribe(
      { gameId },
      { onData: (snapshot) => opponentStates.push(snapshot) },
    )

    onTestFinished(() => {
      creatorSubscription.unsubscribe()
      opponentSubscription.unsubscribe()
    })

    const initialState = {
      turn: 1,
      turnStatus: TurnStatus.COLLECTING_ACTIONS,
      readinessByPlayerId: { [creator.account.id]: false, [opponent.account.id]: false },
    }
    await expect.poll(() => creatorStates.at(-1)).toMatchObject(initialState)
    await expect.poll(() => opponentStates.at(-1)).toMatchObject(initialState)

    // Act
    const { rows } = await postgres.db.$client.query<{ disconnected: boolean }>(
      "SELECT pg_terminate_backend(pid, 1000) AS disconnected FROM pg_stat_activity WHERE application_name = 'turn-state-listener' AND datname = current_database()",
    )
    expect(rows).toStrictEqual([{ disconnected: true }])
    await postgres.db.update(playersTable).set({ isReady: true }).where(eq(playersTable.gameId, gameId))
    const listenerDuringWrite = await postgres.db.$client.query(
      "SELECT pid FROM pg_stat_activity WHERE application_name = 'turn-state-listener' AND datname = current_database()",
    )
    expect(listenerDuringWrite.rows).toStrictEqual([])

    // Assert
    const recoveredState = {
      ...initialState,
      readinessByPlayerId: { [creator.account.id]: true, [opponent.account.id]: true },
    }
    await expect.poll(() => creatorStates.at(-1), { timeout: 5_000 }).toMatchObject(recoveredState)
    await expect.poll(() => opponentStates.at(-1), { timeout: 5_000 }).toMatchObject(recoveredState)
  })

  it("should publish only committed turn-state changes", async () => {
    // Arrange
    const postgres = await createConcurrencyTestDb()
    onTestFinished(async () => {
      await postgres[Symbol.asyncDispose]()
    })
    const api = await ConcurrencyTestApiServer.create(postgres)
    onTestFinished(async () => {
      await api[Symbol.asyncDispose]()
    })
    const creator = await api.createClient({ authenticated: true })
    const configuration = createGameConfigurationStub({ turnIntervalSeconds: 3600 })
    const { createdGameId: gameId } = await creator.client.games.create.mutate({ configuration })
    await creator.client.games.startGame.mutate({ gameId })

    const observer = await postgres.db.$client.connect()
    onTestFinished(() => {
      observer.release(true)
    })
    const writer = await postgres.db.$client.connect()
    onTestFinished(() => {
      writer.release(true)
    })
    const notifications: Array<string | undefined> = []
    observer.on("notification", ({ payload }) => notifications.push(payload))
    await observer.query("LISTEN turn_state_changed")

    // Act
    await writer.query("UPDATE players SET is_ready = false WHERE game_id = $1", [gameId])
    await writer.query("BEGIN")
    await writer.query("UPDATE players SET is_ready = true WHERE game_id = $1", [gameId])
    await writer.query("ROLLBACK")
    await writer.query("BEGIN")
    await writer.query("UPDATE players SET is_ready = true WHERE game_id = $1", [gameId])
    await writer.query("UPDATE turns SET ends_at = ends_at + interval '1 minute' WHERE game_id = $1", [gameId])
    await writer.query("COMMIT")
    await writer.query("SELECT pg_notify('turn_state_changed', 'test-complete')")

    // Assert
    await expect.poll(() => notifications.at(-1)).toBe("test-complete")
    expect(notifications).toStrictEqual([gameId.toString(), "test-complete"])
  })
})
