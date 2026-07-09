import { randomUUID } from "crypto"
import { fork } from "node:child_process"
import { once } from "node:events"
import { setTimeout } from "node:timers/promises"
import { Assert, FatalError, Logger, Result } from "@guillaume-docquier/tools-ts"
import { PostgreSqlContainer } from "@testcontainers/postgresql"
import { type createTRPCClient } from "@trpc/client"
import { z } from "zod"
import { AccountsRepository, type AccountModel } from "#api/accounts/accounts.repository.ts"
import type { TrpcRouter } from "#api/createApi.ts"
import { createDb } from "#lib/db/createDb.ts"
import { TrpcClient } from "#tests/TrpcClient.ts"

// The image is the same we use to dev locally, keep it this way.
// See infra/docker-compose.yaml
const POSTGRES_IMAGE = "postgres:18.4"

const API_LOGS = "ignore" // set to inherit to see api logs

const API_START_TIMEOUT_MS = 30_000

export type LoadTestServer = {
  readonly accountsRepository: AccountsRepository
  readonly createClient: (account: AccountModel) => ReturnType<typeof createTRPCClient<TrpcRouter>>
  readonly close: () => Promise<void>
}

export async function createLoadTestServer(): Promise<LoadTestServer> {
  const logger = Logger.get()
  const postgresContainer = await new PostgreSqlContainer(POSTGRES_IMAGE).start()
  const databaseUrl = postgresContainer.getConnectionUri()
  const api = await startApi({ databaseUrl })

  const db = createDb({ databaseUrl })
  const accountsRepository = new AccountsRepository({ db, logger })

  return {
    accountsRepository,
    createClient: (account) => TrpcClient.create({ port: api.port, authId: account.authId }),
    close: async () => {
      await api.stop()
      await postgresContainer.stop()
    },
  }
}

export async function createAccounts({
  accountsRepository,
  nbAccounts,
}: {
  accountsRepository: AccountsRepository
  nbAccounts: number
}): Promise<AccountModel[]> {
  const accounts: AccountModel[] = []

  for (let accountNumber = 0; accountNumber < nbAccounts; accountNumber++) {
    const accountResult = await accountsRepository.createAccount({
      authId: `load-test-account-${randomUUID()}`,
      email: `load-test-${randomUUID()}@example.com`,
      alias: `Load Test ${accountNumber}`,
    })
    if (Result.isFailure(accountResult)) {
      throw new Error(accountResult.error)
    }

    accounts.push(accountResult.value)
  }

  return accounts
}

export async function ignoreExpectedRequestFailures(requests: Array<Promise<unknown>>): Promise<void> {
  await Promise.allSettled(requests)
}

export async function randomDelay(): Promise<void> {
  await setTimeout(Math.floor(Math.random() * 20))
}

const PortListeningMessage = z.object({
  type: z.literal("listening"),
  port: z.coerce.number(),
})

async function startApi({ databaseUrl }: { databaseUrl: string }): Promise<{ port: number; stop: () => Promise<void> }> {
  const apiProcess = fork("src/api/entry.api.ts", {
    cwd: process.cwd(),
    detached: true,
    env: {
      ...process.env,
      AUTH_SERVICE: "test-header",
      CLERK_PUBLISHABLE_KEY: "load-test-clerk-publishable-key",
      CLERK_SECRET_KEY: "load-test-clerk-secret-key",
      DATABASE_URL: databaseUrl,
      PORT: "0",
    },
    stdio: API_LOGS,
  })
  Assert.isDefined(apiProcess.pid)

  const apiReady = Promise.withResolvers<number>()
  apiProcess.on("message", (message) => {
    const parsedMessage = PortListeningMessage.parse(message)
    apiReady.resolve(parsedMessage.port)
  })

  let died = false
  apiProcess.on("close", () => {
    died = true
  })

  const port = await Promise.race([apiReady.promise, timeout(API_START_TIMEOUT_MS)])
  if (Error.isError(port)) {
    throw port
  }

  return {
    port,
    stop: async () => {
      if (!died) {
        const closePromise = once(apiProcess, "close")
        apiProcess.kill("SIGTERM")
        await closePromise
      }
    },
  }
}

async function timeout(timeoutMs: number): Promise<FatalError<{ timeoutMs: number }>> {
  await setTimeout(timeoutMs)
  return new FatalError("API process did not start in time", { timeoutMs })
}
