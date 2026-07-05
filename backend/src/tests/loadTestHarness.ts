import { randomUUID } from "crypto"
import { spawn, type ChildProcess } from "node:child_process"
import { once } from "node:events"
import { createServer, type Server } from "node:http"
import { Result } from "@guillaume-docquier/tools-ts"
import { createTRPCClient, httpBatchLink } from "@trpc/client"
import { GenericContainer, type StartedTestContainer } from "testcontainers"
import { AccountsRepository, type AccountModel } from "#api/accounts/accounts.repository.ts"
import type { TrpcRouter } from "#api/createApi.ts"
import { configureLogger } from "#lib/configureLogger.ts"
import { createDb } from "#lib/db/createDb.ts"

const ACCOUNT_ID_HEADER = "x-test-account-id"
const POSTGRES_PORT = 5432
const API_START_TIMEOUT_MS = 30_000
const API_HEALTH_CHECK_INTERVAL_MS = 100

export type LoadTestServer = {
  readonly accountsRepository: AccountsRepository
  readonly createClient: (account: AccountModel) => ReturnType<typeof createTRPCClient<TrpcRouter>>
  readonly close: () => Promise<void>
}

const loadTestLogger = configureLogger({ scope: "load-test", nonBlocking: false })

export async function createLoadTestServer(): Promise<LoadTestServer> {
  const logger = await loadTestLogger
  const postgres = await startPostgresContainer()
  const databaseUrl = getPostgresConnectionUri(postgres)
  const apiPort = await getAvailablePort()
  const apiProcess = startApiProcess({ databaseUrl, port: apiPort })

  await waitForApi({ apiProcess, port: apiPort })

  const db = createDb({ databaseUrl })
  const accountsRepository = new AccountsRepository({ db, logger })

  return {
    accountsRepository,
    createClient: (account) =>
      createTRPCClient<TrpcRouter>({
        links: [
          httpBatchLink({
            url: `http://localhost:${apiPort}/trpc`,
            headers: { [ACCOUNT_ID_HEADER]: account.id },
          }),
        ],
      }),
    close: async () => {
      await stopApiProcess(apiProcess)
      await postgres.stop()
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
  await new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * 20)))
}

async function startPostgresContainer(): Promise<StartedTestContainer> {
  return await new GenericContainer("postgres:18-alpine")
    .withEnvironment({
      POSTGRES_DB: "test",
      POSTGRES_PASSWORD: "test",
      POSTGRES_USER: "test",
    })
    .withExposedPorts(POSTGRES_PORT)
    .start()
}

function getPostgresConnectionUri(postgres: StartedTestContainer): string {
  return `postgres://test:test@${postgres.getHost()}:${postgres.getMappedPort(POSTGRES_PORT)}/test`
}

async function getAvailablePort(): Promise<number> {
  const server = createServer()
  server.listen(0)
  await once(server, "listening")
  const address = server.address()
  await closePortProbe(server)

  if (address === null || typeof address === "string") {
    throw new Error("Could not allocate API port for load test")
  }

  return address.port
}

async function closePortProbe(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error === undefined) {
        resolve()
        return
      }

      reject(error)
    })
  })
}

function startApiProcess({ databaseUrl, port }: { databaseUrl: string; port: number }): ChildProcess {
  return spawn(process.execPath, ["src/api/entry.api.ts"], {
    cwd: process.cwd(),
    detached: true,
    env: {
      ...process.env,
      AUTH_SERVICE: "test-header",
      CLERK_PUBLISHABLE_KEY: "load-test-clerk-publishable-key",
      CLERK_SECRET_KEY: "load-test-clerk-secret-key",
      DATABASE_URL: databaseUrl,
      PORT: port.toString(),
    },
    stdio: "ignore",
  })
}

async function waitForApi({ apiProcess, port }: { apiProcess: ChildProcess; port: number }): Promise<void> {
  const deadline = performance.now() + API_START_TIMEOUT_MS

  while (performance.now() < deadline) {
    if (apiProcess.exitCode !== null) {
      throw new Error(`API process exited before startup with code ${apiProcess.exitCode}`)
    }

    const healthResult = await Result.tryCatch(fetch(`http://localhost:${port}/health`))
    if (Result.isSuccess(healthResult) && healthResult.value.ok) {
      return
    }

    await new Promise((resolve) => setTimeout(resolve, API_HEALTH_CHECK_INTERVAL_MS))
  }

  throw new Error("API process did not become healthy before the startup timeout")
}

async function stopApiProcess(apiProcess: ChildProcess): Promise<void> {
  if (apiProcess.exitCode !== null) {
    return
  }

  const exitPromise = once(apiProcess, "exit")
  if (apiProcess.pid === undefined) {
    apiProcess.kill("SIGTERM")
  } else {
    process.kill(-apiProcess.pid, "SIGTERM")
  }

  await exitPromise
}
