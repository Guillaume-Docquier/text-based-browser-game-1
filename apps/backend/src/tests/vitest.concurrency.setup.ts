import { beforeAll } from "vitest"
import { TestContainers } from "#tests/vitest.concurrency.setup.test-containers.ts"

// This cannot be a fixture because the fixture is part of the test, and we want the preload time to not be included in the test time
beforeAll(async () => {
  await TestContainers.preload()
}, TestContainers.timeoutMs)
