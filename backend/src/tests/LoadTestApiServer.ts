import { fork } from "node:child_process"
import { once } from "node:events"
import { setTimeout } from "node:timers/promises"
import { Assert, FatalError, Logger } from "@guillaume-docquier/tools-ts"
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql"
import { type TRPCClient } from "@trpc/client"
import { z } from "zod"
import { AccountsRepository, type AccountModel } from "#api/accounts/accounts.repository.ts"
import { createNewAccountModelStub } from "#api/accounts/NewAccountModel.stub.ts"
import type { TrpcRouter } from "#api/createApi.ts"
import { createDb } from "#lib/db/createDb.ts"
import { extractSuccess } from "#tests/extractSuccess.ts"
import { TrpcClient } from "#tests/TrpcClient.ts"

// The image is the same we use to dev locally, keep it this way.
// See infra/docker-compose.yaml
const POSTGRES_IMAGE = "postgres:18.4"
/**
 * Set to "ignore" to lower the noise
 * Set to "inherit" to debug what's going on inside the apiServer
 */
const API_LOGS = "ignore"

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
  private readonly accountsRepository: AccountsRepository

  public static async create(): Promise<LoadTestApiServer> {
    const postgresContainer = await new PostgreSqlContainer(POSTGRES_IMAGE).start()
    const databaseUrl = postgresContainer.getConnectionUri()
    const apiServer = await startApiServer({ databaseUrl })
    const accountsRepository = new AccountsRepository({ db: createDb({ databaseUrl }), logger: Logger.get() })

    return new LoadTestApiServer({ postgresContainer, apiServer, accountsRepository })
  }

  private constructor({
    postgresContainer,
    apiServer,
    accountsRepository,
  }: {
    postgresContainer: StartedPostgreSqlContainer
    apiServer: ApiServer
    accountsRepository: AccountsRepository
  }) {
    this.postgresContainer = postgresContainer
    this.apiServer = apiServer
    this.accountsRepository = accountsRepository
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
    await this.apiServer.stop()
    await this.postgresContainer.stop()
  }
}

const PortListeningMessage = z.object({
  type: z.literal("listening"),
  port: z.coerce.number(),
})

type ApiServer = { port: number; stop: () => Promise<void> }

async function startApiServer({ databaseUrl }: { databaseUrl: string }): Promise<ApiServer> {
  const apiProcess = fork("src/api/entry.api.ts", {
    cwd: process.cwd(),
    detached: true,
    env: {
      ...process.env,
      AUTH_SERVICE: "test-header",
      CLERK_PUBLISHABLE_KEY: "load-test-clerk-publishable-key",
      CLERK_SECRET_KEY: "load-test-clerk-secret-key",
      DATABASE_URL: databaseUrl,
      PORT: ANY_UNUSED_PORT.toString(),
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
