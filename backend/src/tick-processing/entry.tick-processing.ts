import { type Logger } from "@guillaume-docquier/tools-ts"
import { SHARE_ENV, Worker, isMainThread } from "node:worker_threads"
import { processTick } from "#tick-processing/processTick.ts"

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
  setInterval(() => {
    processTick()
  }, 1000)
}
