import { createConsoleLogSink, jsonLineFormatter, Logger, prettyConsoleFormatter } from "@guillaume-docquier/tools-ts"
import { SHARE_ENV, Worker, isMainThread } from "node:worker_threads"
import { processTick } from "#tick-processing/processTick.ts"
import { parseEnv } from "#lib/parseEnv.ts"
import { drizzle } from "drizzle-orm/node-postgres"
import { PlayersRepository } from "#lib/db/players.repository.ts"
import { GamesRepository } from "#lib/db/games.repository.ts"

/**
 * Starts tick processing.
 * For now, tick processing consists of a single worker doing all the work.
 * No synchronization needed, auto restarts.
 */
export function startTickProcessing({ logger }: { logger: Logger }): void {
  logger.info("Starting tick processing")
  const tickProcessor = new Worker(new URL(import.meta.url), {
    env: SHARE_ENV,
  })

  tickProcessor.once("error", (error) => {
    logger.error("Tick processor worker errored unexpectedly", { error })
  })

  tickProcessor.once("exit", (code) => {
    logger.error("Tick processor worker exited unexpectedly, starting a new one", { code })
    startTickProcessing({ logger })
  })
}

if (!isMainThread) {
  const isProd = process.env.NODE_ENV === "production"
  const logger = (
    await Logger.configure({
      sinks: {
        console: createConsoleLogSink({
          formatter: isProd ? jsonLineFormatter : prettyConsoleFormatter,
          redaction: { enabled: isProd },
        }),
      },
    })
  ).child({ scope: "tick-processing" })

  logger.info("Parsing environment")
  const env = parseEnv({ logger })

  logger.info("Connecting to the database")
  const db = drizzle({
    connection: {
      connectionString: env.DATABASE_URL,
      // I probably want ssl?
      // ssl: true,
    },
  })

  logger.info("Creating services")
  const playersRepository = new PlayersRepository({ db })
  const gamesRepository = new GamesRepository({ db, logger })

  logger.info("Processing ticks")
  setInterval(() => {
    void processTick({ logger, playersRepository, gamesRepository })
  }, 1000)
}
