import { Assert } from "@guillaume-docquier/tools-ts"
import type { Pool, PoolClient } from "pg"

export function createPostgresPoolDisposal(pool: Pool): () => Promise<void> {
  Assert.isTrue(pool.totalCount === 0)
  const disconnects = new Set<Promise<undefined>>()

  const trackConnection = (client: PoolClient): void => {
    const disconnected = Promise.withResolvers<undefined>()
    disconnects.add(disconnected.promise)
    client.once("end", () => {
      disconnects.delete(disconnected.promise)
      disconnected.resolve(undefined)
    })
  }
  pool.on("connect", trackConnection)

  let closing: Promise<void>
  return async (): Promise<void> => {
    await (closing ??= (async (): Promise<void> => {
      await pool.end()
      await Promise.all(disconnects)
      pool.off("connect", trackConnection)
    })())
  }
}
