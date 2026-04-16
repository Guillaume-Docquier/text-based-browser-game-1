import { type Logger } from "@guillaume-docquier/tools-ts"
import { SHARE_ENV, Worker, isMainThread } from "node:worker_threads"
import { processTick } from "#tick-processing/processTick.ts"
import { envSchema, parseEnv } from "#lib/parseEnv.ts"
import { configureLogger } from "#lib/configureLogger.ts"
import { connectToDb } from "#lib/db/connectToDb.ts"
import { GameTicksRepository } from "#lib/db/gameTicks.repository.ts"
import { GameStatesRepository } from "#lib/db/gameStates.repository.ts"
import { GamePlayerResourcesRepository } from "#lib/db/gamePlayerResources.repository.ts"
import { GamesRepository } from "#lib/db/games.repository.ts"

/**
 * Starts tick processing.
 * For now, tick processing consists of a single worker doing all the work.
 * No synchronization needed, auto restarts.
 */
export function startTickProcessing({ logger }: { logger: Logger }): void {
  logger.info("Creating a single tick processing worker")
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

/**
 * Tick processing worker entry point.
 */
if (!isMainThread) {
  const logger = await configureLogger({ scope: "tick-processing" })

  logger.info("Parsing environment")
  const env = parseEnv({ logger, envSchema })

  logger.info("Connecting to the database")
  const db = connectToDb({ databaseUrl: env.DATABASE_URL })

  logger.info("Creating services")
  const repositories = {
    gamesRepository: new GamesRepository({ db, logger }),
    gameTicksRepository: new GameTicksRepository({ db, logger }),
    gameStatesRepository: new GameStatesRepository({ db, logger }),
    gamePlayerResourcesRepository: new GamePlayerResourcesRepository({ db, logger }),
  }

  logger.info("Processing ticks")
  setInterval(() => {
    void processTick({ logger, ...repositories })
  }, 1000)
}
