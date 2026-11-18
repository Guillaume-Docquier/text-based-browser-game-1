import { Assert } from "@guillaume-docquier/tools-ts"
import { test } from "vitest"

/** Let Vitest own the worker lifetime while ordinary it() callbacks acquire their own databases. */
export function defineWorkerResource<T>(create: (cleanup: AsyncDisposableStack) => Promise<T>): {
  register: (timeout?: number) => void
  get: () => T
} {
  let current: T | undefined
  // oxlint-disable-next-line no-restricted-properties, no-empty-pattern -- ADR-035 permits this worker fixture. Vitest requires destructuring even with no dependencies.
  const worker = test.extend("resource", { scope: "worker" }, async ({}, { onCleanup }) => {
    const cleanup = new AsyncDisposableStack()
    onCleanup(async () => {
      current = undefined
      await cleanup.disposeAsync()
    })
    return await create(cleanup)
  })
  return {
    register(timeout): void {
      worker.beforeAll(({ resource }) => {
        current = resource
      }, timeout)
    },
    get(): T {
      Assert.isDefined(current)
      return current
    },
  }
}
