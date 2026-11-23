import { setupWorker, type SetupWorker } from "msw/browser"
import { afterAll, afterEach, beforeAll } from "vitest"

export function setupBrowserApiWorker(): SetupWorker {
  const worker = setupWorker()
  beforeAll(async () => {
    await worker.start({ onUnhandledRequest: "bypass", quiet: true })
  })
  afterEach(() => {
    worker.resetHandlers()
  })
  afterAll(() => {
    worker.stop()
  })
  return worker
}
