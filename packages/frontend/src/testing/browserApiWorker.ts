import { setupWorker, type SetupWorker } from "msw/browser"
import { afterAll, afterEach, beforeAll } from "vitest"

export function setupBrowserApiWorker(): SetupWorker {
  const worker = setupWorker()
  beforeAll(async () => {
    await worker.start({ onUnhandledFrame: "bypass", quiet: true })
  })
  afterEach(() => {
    worker.resetHandlers()
  })
  afterAll(async () => {
    await worker.stop()
  })
  return worker
}
