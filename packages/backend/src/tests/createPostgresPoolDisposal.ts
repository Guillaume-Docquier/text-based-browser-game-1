import { Assert } from "@guillaume-docquier/tools-ts"
import type { Pool, PoolClient } from "pg"

/** Register before the first connection so disposal also waits for clients removed from the pool earlier. */
export function createPostgresPoolDisposal(pool: Pool): AsyncDisposable {
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

  let closing: Promise<void> | undefined
  return {
    async [Symbol.asyncDispose](): Promise<void> {
      await (closing ??= (async (): Promise<void> => {
        // pg-pool removes clients from its list before their sockets have finished closing.
        await pool.end()
        await Promise.all(disconnects)
        pool.off("connect", trackConnection)
      })())
    },
  }
}
