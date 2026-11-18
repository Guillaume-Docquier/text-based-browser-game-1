import { Pool } from "pg"
import { expect, onTestFinished } from "vitest"
import { createPostgresPoolDisposal } from "#tests/createPostgresPoolDisposal.ts"
import { concurrencyTest } from "#tests/vitest.concurrency.fixture.ts"

concurrencyTest("should wait for idle and previously removed connections to close during pool disposal", async ({ postgres }) => {
  // Arrange
  const pool = new Pool({ connectionString: postgres.databaseUrl })
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
})
