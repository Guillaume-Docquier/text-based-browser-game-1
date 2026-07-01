import { SHARE_ENV, Worker, isMainThread } from "node:worker_threads"
import { type Logger, Profile, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { Clock } from "#lib/Clock.ts"
import { configureLogger } from "#lib/configureLogger.ts"
import { createCreateTransaction, createDb } from "#lib/db/createDb.ts"
import { envSchema, parseEnv } from "#lib/parseEnv.ts"
import { repeat } from "#lib/repeat.ts"
import { TickProcessor } from "#tick-processing/TickProcessor.ts"
import { TicksRepository } from "#tick-processing/ticks.repository.ts"

/**
 * Starts tick processing.
 * For now, tick processing consists of a single worker doing all the work.
 * No synchronization needed, auto restarts.
 */
export function startTickProcessing({ logger }: { logger: Logger }): void {
  logger.info("Creating a single tick processing worker")
  const tickProcessorWorker = new Worker(new URL(import.meta.url), {
    env: SHARE_ENV,
  })

  tickProcessorWorker.once("error", (error) => {
    logger.error("Tick processor worker errored unexpectedly", { error })
  })

  tickProcessorWorker.once("exit", (code) => {
    logger.error("Tick processor worker exited unexpectedly, starting a new one", { code })
    startTickProcessing({ logger })
  })
}

/**
 * Tick processing worker entry point.
 */
if (!isMainThread) {
  const logger = await configureLogger({ scope: "tick-processing" })

  logger.info("Parsing environment")
  const env = parseEnv({ logger, schema: envSchema })

  logger.info("Connecting to the database")
  const db = createDb({ databaseUrl: env.DATABASE_URL })

  logger.info("Creating services")
  const clock = Clock
  const ticksRepository = new TicksRepository({ db, logger, clock })
  const createTransaction = createCreateTransaction(db)

  const tickProcessor = new TickProcessor({ logger, clock, createTransaction, ticksRepository })

  logger.info("Processing ticks forever")
  await processTicksForever(tickProcessor, 1000)

  // We'll capture the memory usage reported by node a few times to compare with what Railway says
  // There's always a spike at launch, which should settle after a minute or two
  repeat({
    times: 5,
    delay: Time.create(1, UnitOfTime.MINUTES),
    operation: () => {
      Profile.memoryUsage(logger)
    },
  })
}

async function processTicksForever(tickProcessor: TickProcessor, frequency: number): Promise<void> {
  await tickProcessor.processNextDueTick()
  setTimeout(() => void processTicksForever(tickProcessor, frequency), frequency)
}
