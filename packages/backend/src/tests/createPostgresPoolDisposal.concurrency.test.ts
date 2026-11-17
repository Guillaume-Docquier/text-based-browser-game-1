import { Pool } from "pg"
import { expect, onTestFinished } from "vitest"
import { createPostgresPoolDisposal } from "#tests/createPostgresPoolDisposal.ts"
import { concurrencyTest } from "#tests/vitest.concurrency.fixture.ts"

concurrencyTest(
  "pool disposal waits for idle and previously removed connections to close",
  async ({ postgresDatabase: { databaseUrl } }) => {
    // Arrange
    const pool = new Pool({ connectionString: databaseUrl })
    const closePool = createPostgresPoolDisposal(pool)
    onTestFinished(closePool)

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
  },
)
