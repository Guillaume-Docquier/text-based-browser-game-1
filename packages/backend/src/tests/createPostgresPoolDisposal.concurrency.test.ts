import { Pool } from "pg"
import { expect } from "vitest"
import { createPostgresPoolDisposal } from "#tests/createPostgresPoolDisposal.ts"
import { concurrencyTest } from "#tests/vitest.concurrency.fixture.ts"

concurrencyTest(
  "pool disposal waits for idle and previously removed connections to close",
  async ({ postgresDatabase: { databaseUrl } }) => {
    // Arrange
    const pool = new Pool({ connectionString: databaseUrl })
    await using disposal = createPostgresPoolDisposal(pool)
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
    await disposal[Symbol.asyncDispose]()

    // Assert
    expect(disconnected.sort()).toStrictEqual(["idle", "removed"])
  },
)
