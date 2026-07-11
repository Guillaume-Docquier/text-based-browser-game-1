import { fork } from "node:child_process"
import { once } from "node:events"
import { setTimeout } from "node:timers/promises"
import { Assert, FatalError, Logger } from "@guillaume-docquier/tools-ts"
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql"
import { type TRPCClient } from "@trpc/client"
import { AccountsRepository, type AccountModel } from "#api/accounts/accounts.repository.ts"
import { createNewAccountModelStub } from "#api/accounts/NewAccountModel.stub.ts"
import type { TrpcRouter } from "#api/createApi.ts"
import { PortListeningMessage } from "#api/PortListeningMessage.ts"
import { createDb, type Database } from "#lib/db/createDb.ts"
import { extractSuccess } from "#tests/extractSuccess.ts"
import { TrpcClient } from "#tests/TrpcClient.ts"

// The image is the same we use to dev locally, keep it this way.
// See infra/docker-compose.yaml
const POSTGRES_IMAGE = "postgres:18.4"
/**
 * Set to "ignore" to lower the noise
 * Set to "inherit" to debug what's going on inside the apiServer
 */
const API_LOGS: "ignore" | "inherit" = "inherit"

const API_START_TIMEOUT_MS = 30_000

/**
 * I can't find the documentation, but server.listen(0) gets assigned an unused port.
 * Great for testing.
 */
const ANY_UNUSED_PORT = 0

type AuthenticatedApiClient = {
  readonly client: TRPCClient<TrpcRouter>
  readonly account: AccountModel
}

type AnonymousApiClient = {
  readonly client: TRPCClient<TrpcRouter>
  readonly account: undefined
}

export class LoadTestApiServer {
  private readonly postgresContainer: StartedPostgreSqlContainer
  private readonly apiServer: ApiServer
  private readonly db: Database
  private readonly accountsRepository: AccountsRepository

  public static async create(): Promise<LoadTestApiServer> {
    const postgresContainer = await new PostgreSqlContainer(POSTGRES_IMAGE).start()
    const databaseUrl = postgresContainer.getConnectionUri()
    const apiServer = await forkApiServer({ databaseUrl })
    const db = createDb({ databaseUrl })

    return new LoadTestApiServer({ postgresContainer, apiServer, db })
  }

  private constructor({
    postgresContainer,
    apiServer,
    db,
  }: {
    postgresContainer: StartedPostgreSqlContainer
    apiServer: ApiServer
    db: Database
  }) {
    this.postgresContainer = postgresContainer
    this.apiServer = apiServer
    this.db = db
    this.accountsRepository = new AccountsRepository({ db, logger: Logger.get() })
  }

  public async createClient(args: { authenticated: true }): Promise<AuthenticatedApiClient>
  public async createClient(args: { authenticated: false }): Promise<AnonymousApiClient>
  public async createClient({ authenticated }: { authenticated: boolean }): Promise<AuthenticatedApiClient | AnonymousApiClient> {
    if (!authenticated) {
      return {
        client: TrpcClient.create({ port: this.apiServer.port, authId: undefined }),
        account: undefined,
      }
    }

    const account = extractSuccess(await this.accountsRepository.createAccount(createNewAccountModelStub()))

    return {
      client: TrpcClient.create({ port: this.apiServer.port, authId: account.authId }),
      account,
    }
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    if (API_LOGS === "inherit") {
      // Let the api logs flush
      await setTimeout(100)
    }

    await Promise.all([this.apiServer.stop(), this.db.$client.end()])
    await this.postgresContainer.stop()
  }
}

type ApiServer = {
  port: number
  stop: () => Promise<void>
}

/**
 * Starts a real api in a forked process.
 * The goal of this is to use an unadulterated api server running on its own thread.
 */
async function forkApiServer({ databaseUrl }: { databaseUrl: string }): Promise<ApiServer> {
  const apiProcess = fork("src/api/entry.api.ts", {
    cwd: process.cwd(),
    detached: true,
    env: {
      AUTH_SERVICE: "test-header",
      CLERK_PUBLISHABLE_KEY: "does not matter with test-header auth",
      CLERK_SECRET_KEY: "does not matter with test-header auth",
      DATABASE_URL: databaseUrl,
      PORT: ANY_UNUSED_PORT.toString(),
    },
    stdio: API_LOGS,
  })
  Assert.isDefined(apiProcess.pid)

  const apiReady = Promise.withResolvers<number>()
  apiProcess.once("message", (message) => {
    apiReady.resolve(PortListeningMessage.parse(message).port)
  })

  let died = false
  apiProcess.once("close", () => {
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
