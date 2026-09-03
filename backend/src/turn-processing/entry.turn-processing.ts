import { isMainThread, SHARE_ENV, Worker } from "node:worker_threads"
import { type Logger, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { Clock } from "#lib/Clock.ts"
import { configureLogger } from "#lib/configureLogger.ts"
import { createCreateTransaction, createDb } from "#lib/db/createDb.ts"
import { monitorMemoryUsage } from "#lib/monitorMemoryUsage.ts"
import { envSchema, parseEnv } from "#lib/parseEnv.ts"
import { TurnProcessor } from "#turn-processing/TurnProcessor.ts"
import { TurnsRepository } from "#turn-processing/turns.repository.ts"

/**
 * Starts turn processing.
 * For now, turn processing consists of a single worker doing all the work.
 * No synchronization needed, auto restarts.
 */
export function startTurnProcessing({ logger }: { logger: Logger }): void {
  logger.info("Creating a single turn processing worker")
  const turnProcessorWorker = new Worker(new URL(import.meta.url), {
    env: SHARE_ENV,
  })

  turnProcessorWorker.once("error", (error) => {
    logger.error("Turn processor worker errored unexpectedly", { error })
  })

  turnProcessorWorker.once("exit", (code) => {
    logger.error("Turn processor worker exited unexpectedly, starting a new one", { code })
    startTurnProcessing({ logger })
  })
}

/**
 * Turn processing worker entry point.
 */
if (!isMainThread) {
  const logger = await configureLogger({ scope: "turn-processing" })

  logger.info("Parsing environment")
  const env = parseEnv({ logger, schema: envSchema })

  logger.info("Connecting to the database")
  const db = createDb({ databaseUrl: env.DATABASE_URL })

  logger.info("Creating services")
  const clock = Clock
  const createTransaction = createCreateTransaction(db)
  const turnsRepository = new TurnsRepository({ db, logger })

  const turnProcessor = new TurnProcessor({ logger, clock, createTransaction, turnsRepository })

  logger.info("Processing turns forever")
  // Fire and forget
  void turnProcessor.processTurnsForever({ interval: Time.create(1, UnitOfTime.SECONDS) })

  monitorMemoryUsage({ logger })
}
