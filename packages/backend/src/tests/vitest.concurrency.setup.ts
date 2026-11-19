import { beforeAll } from "vitest"
import { prepareConcurrencyTestDb } from "#tests/createConcurrencyTestDb.ts"

beforeAll(prepareConcurrencyTestDb, 60_000)
