import { setTimeout } from "node:timers/promises"
import { type Logger, Result } from "@guillaume-docquier/tools-ts"
import { Client, escapeIdentifier } from "pg"

type NotificationListenerOptions = {
  channel: string
  onNotification: (payload: string) => void
  onListening: () => void
  signal: AbortSignal
}

export type ListenForPostgresNotifications = (options: NotificationListenerOptions) => Promise<void>

export function createPostgresNotificationListener({
  databaseUrl,
  logger,
}: {
  databaseUrl: string
  logger: Logger
}): ListenForPostgresNotifications {
  return async (options) => {
    while (!options.signal.aborted) {
      const connection = await Result.tryCatch(listen({ ...options, databaseUrl }))
      if (options.signal.aborted) {
        return
      }
      if (Result.isFailure(connection)) {
        logger.error("PostgreSQL notification listener lost its connection", { channel: options.channel, error: connection.error })
      }
      await Result.tryCatch(setTimeout(1000, undefined, { signal: options.signal }))
    }
  }
}

async function listen({
  databaseUrl,
  channel,
  onNotification,
  onListening,
  signal,
}: NotificationListenerOptions & { databaseUrl: string }): Promise<void> {
  const client = new Client({
    connectionString: databaseUrl,
    application_name: "postgres-notification-listener",
    connectionTimeoutMillis: 5_000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
  })
  const connectionEnded = Promise.withResolvers<Error | undefined>()
  client.on("error", connectionEnded.resolve)
  client.on("end", () => {
    connectionEnded.resolve(undefined)
  })
  client.on("notification", (notification) => {
    if (notification.channel === channel && notification.payload !== undefined) {
      onNotification(notification.payload)
    }
  })

  const stop = (): void => {
    connectionEnded.resolve(undefined)
  }
  signal.addEventListener("abort", stop, { once: true })
  try {
    await client.connect()
    await client.query(`LISTEN ${escapeIdentifier(channel)}`)
    if (!signal.aborted) {
      onListening()
    }
    const error = await connectionEnded.promise
    if (error !== undefined) {
      throw error
    }
  } finally {
    signal.removeEventListener("abort", stop)
    await client.end()
  }
}
