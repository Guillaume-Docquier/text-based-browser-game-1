import { setTimeout } from "node:timers/promises"
import { type Logger, Result } from "@guillaume-docquier/tools-ts"
import { Client } from "pg"
import { GameIdSchema, type GameId } from "shared/domain/games/GameId.ts"

const CHANNEL = "turn_state_changed"

type ListenerOptions = {
  databaseUrl: string
  onChange: (gameId: GameId) => void
  onListening: () => void
  signal: AbortSignal
}

export async function listenForTurnStateChanges({ logger, ...options }: ListenerOptions & { logger: Logger }): Promise<void> {
  while (!options.signal.aborted) {
    const connection = await Result.tryCatch(listen(options))
    if (options.signal.aborted) {
      return
    }
    if (Result.isFailure(connection)) {
      logger.error("Turn state listener lost its PostgreSQL connection", { error: connection.error })
    }
    await Result.tryCatch(setTimeout(1000, undefined, { signal: options.signal }))
  }
}

async function listen({ databaseUrl, onChange, onListening, signal }: ListenerOptions): Promise<void> {
  const client = new Client({
    connectionString: databaseUrl,
    application_name: "turn-state-listener",
    connectionTimeoutMillis: 5_000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
  })
  const connectionEnded = Promise.withResolvers<Error | undefined>()
  client.on("error", connectionEnded.resolve)
  client.on("end", () => {
    connectionEnded.resolve(undefined)
  })
  client.on("notification", ({ channel, payload }) => {
    if (channel === CHANNEL && payload !== undefined) {
      const parsed = GameIdSchema.safeParse(Number(payload))
      if (parsed.success) {
        onChange(parsed.data)
      }
    }
  })

  const stop = (): void => {
    connectionEnded.resolve(undefined)
  }
  signal.addEventListener("abort", stop, { once: true })
  try {
    await client.connect()
    await client.query(`LISTEN ${CHANNEL}`)
    onListening()
    const error = await connectionEnded.promise
    if (error !== undefined) {
      throw error
    }
  } finally {
    signal.removeEventListener("abort", stop)
    await client.end()
  }
}
