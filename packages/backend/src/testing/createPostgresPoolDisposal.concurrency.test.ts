import { Pool } from "pg"
import { describe, expect, it } from "vitest"
import { createConcurrencyTestDb } from "#testing/createConcurrencyTestDb.ts"
import { createPostgresPoolDisposal } from "#testing/createPostgresPoolDisposal.ts"

describe("createPostgresPoolDisposal", () => {
  it("should wait for idle and previously removed connections to close during pool disposal", async () => {
    // Arrange
    await using postgres = await createConcurrencyTestDb()
    const pool = new Pool({ connectionString: postgres.databaseUrl })
    const closePool = createPostgresPoolDisposal(pool)
    await using cleanup = new AsyncDisposableStack()
    cleanup.defer(closePool)

    const disconnected: string[] = []
    const [removedClient, idleClient] = await Promise.all([pool.connect(), pool.connect()])
    removedClient.once("end", () => {
      disconnected.push("removed")
    })
    idleClient.once("end", () => {
      disconnected.push("idle")
    })

    removedClient.release(true)
    idleClient.release()

    // Act
    await closePool()

    // Assert
    expect(disconnected.sort()).toStrictEqual(["idle", "removed"])
  })
})
