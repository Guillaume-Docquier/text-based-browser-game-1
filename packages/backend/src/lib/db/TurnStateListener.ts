import { setTimeout } from "node:timers/promises"
import { type Logger, Result } from "@guillaume-docquier/tools-ts"
import { Client } from "pg"
import { type GameId, GameIdSchema } from "shared/domain/games/GameId.ts"

const CHANNEL = "turn_state_changed"

export class TurnStateListener {
  private readonly databaseUrl: string
  private readonly logger: Logger

  public constructor({ databaseUrl, logger }: { databaseUrl: string; logger: Logger }) {
    this.databaseUrl = databaseUrl
    this.logger = logger.child({ scope: "turn-state-listener" })
  }

  public async listen({
    signal,
    onListening,
    onChange,
  }: {
    signal: AbortSignal
    onListening: () => void
    onChange: (gameId: GameId) => void
  }): Promise<void> {
    while (!signal.aborted) {
      await this.listenOnce({ signal, onListening, onChange })
      await Result.tryCatch(setTimeout(1_000, undefined, { signal }))
    }
  }

  private async listenOnce({
    signal,
    onListening,
    onChange,
  }: {
    signal: AbortSignal
    onListening: () => void
    onChange: (gameId: GameId) => void
  }): Promise<void> {
    const client = new Client({
      connectionString: this.databaseUrl,
      connectionTimeoutMillis: 5_000,
      keepAlive: true,
      application_name: "turn-state-listener",
    })
    const disconnected = Promise.withResolvers<undefined>()
    const disconnect = (): void => {
      disconnected.resolve(undefined)
    }
    signal.addEventListener("abort", disconnect, { once: true })
    client.on("end", disconnect)
    client.on("error", (error) => {
      this.logger.error("PostgreSQL turn-state listener disconnected", { error })
      disconnect()
    })
    client.on("notification", ({ channel, payload }) => {
      if (channel !== CHANNEL || payload === undefined || !/^[1-9]\d*$/.test(payload)) {
        return
      }

      const gameId = GameIdSchema.safeParse(Number(payload))
      if (gameId.success) {
        onChange(gameId.data)
      }
    })

    try {
      const result = await Result.tryCatch(async () => {
        await client.connect()
        await client.query(`LISTEN ${CHANNEL}`)
      })
      if (Result.isFailure(result)) {
        this.logger.error("Could not listen for turn-state changes", { error: result.error })
        return
      }

      if (!signal.aborted) {
        onListening()
        await disconnected.promise
      }
    } finally {
      signal.removeEventListener("abort", disconnect)
      await Result.tryCatch(client.end())
    }
  }
}
