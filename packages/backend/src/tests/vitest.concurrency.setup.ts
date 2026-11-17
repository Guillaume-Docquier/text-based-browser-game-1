import { beforeAll } from "vitest"
import { TestContainers } from "#tests/vitest.concurrency.setup.test-containers.ts"

// Fixture setup counts toward test timing, so preload images in a hook instead.
beforeAll(async () => {
  await TestContainers.preload()
}, TestContainers.timeoutMs)
