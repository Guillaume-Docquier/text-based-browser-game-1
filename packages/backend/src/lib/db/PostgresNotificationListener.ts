import { setTimeout } from "node:timers/promises"
import { type Logger, Result } from "@guillaume-docquier/tools-ts"
import { Client, escapeIdentifier } from "pg"

type NotificationHandlers = {
  onPayload: (payload: string) => void
  onReady: () => void
}

export interface NotificationListener {
  listen: (channel: string, handlers: NotificationHandlers) => void
}

export class PostgresNotificationListener implements NotificationListener, AsyncDisposable {
  private readonly databaseUrl: string
  private readonly logger: Logger
  private readonly stop = new AbortController()
  private listening?: Promise<void>

  public constructor({ databaseUrl, logger }: { databaseUrl: string; logger: Logger }) {
    this.databaseUrl = databaseUrl
    this.logger = logger
  }

  public listen(channel: string, handlers: NotificationHandlers): void {
    this.listening = this.maintainConnection(channel, handlers)
  }

  private async maintainConnection(channel: string, { onPayload, onReady }: NotificationHandlers): Promise<void> {
    while (!this.stop.signal.aborted) {
      const client = new Client({
        connectionString: this.databaseUrl,
        application_name: "turn-state-listener",
        connectionTimeoutMillis: 5000,
      })
      const disconnected = Promise.withResolvers<undefined>()
      const disconnect = (): void => {
        disconnected.resolve(undefined)
      }
      this.stop.signal.addEventListener("abort", disconnect, { once: true })
      client.on("error", (error) => {
        this.logger.error("PostgreSQL notification connection failed", { error })
        disconnected.resolve(undefined)
      })
      client.once("end", () => {
        disconnected.resolve(undefined)
      })
      client.on("notification", (message) => {
        if (message.channel === channel && message.payload !== undefined) {
          onPayload(message.payload)
        }
      })
      const listening = await Result.tryCatch(async () => {
        await client.connect()
        await client.query("LISTEN " + escapeIdentifier(channel))
        onReady()
        await disconnected.promise
      })
      if (Result.isFailure(listening)) {
        this.logger.error("Could not listen for PostgreSQL notifications", { error: listening.error })
      }
      this.stop.signal.removeEventListener("abort", disconnect)
      await client.end()
      if (!this.stop.signal.aborted) {
        await setTimeout(1000)
      }
    }
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    this.stop.abort()
    await this.listening
  }
}
