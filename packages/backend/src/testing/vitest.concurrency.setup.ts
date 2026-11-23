import { beforeAll } from "vitest"
import { prepareConcurrencyTestDb } from "#testing/createConcurrencyTestDb.ts"

beforeAll(prepareConcurrencyTestDb, 60_000)
