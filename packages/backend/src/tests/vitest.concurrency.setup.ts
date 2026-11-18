import { beforeAll } from "vitest"
import { prepareConcurrencyTestDb } from "#tests/createConcurrencyTestDb.ts"

// Allow the worker to pull the PostgreSQL image before the first test starts.
beforeAll(prepareConcurrencyTestDb, 60_000)
