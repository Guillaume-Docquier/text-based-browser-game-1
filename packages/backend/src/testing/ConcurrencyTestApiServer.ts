import { fork } from "node:child_process"
import { once } from "node:events"
import { setTimeout } from "node:timers/promises"
import { Assert, FatalError, Logger } from "@guillaume-docquier/tools-ts"
import { AccountsRepository } from "#api/accounts/accounts.repository.ts"
import { PortListeningMessageSchema } from "#api/PortListeningMessage.ts"
import type { Database } from "#lib/db/createDb.ts"
import { AuthProviderKind } from "#lib/parseEnv.ts"
import { type AnonymousApiClient, type AuthenticatedApiClient, createApiClient } from "#testing/ApiClient.ts"

const API_LOGS: "ignore" | "inherit" = "inherit"

const API_START_TIMEOUT_MS = 30_000

const ANY_UNUSED_PORT = 0

export class ConcurrencyTestApiServer {
  private readonly server: ForkedServer
  private readonly accountsRepository: AccountsRepository

  public static async create({ databaseUrl, db }: { databaseUrl: string; db: Database }): Promise<ConcurrencyTestApiServer> {
    const server = await forkApiServer({ databaseUrl })
    const accountsRepository = new AccountsRepository({ db, logger: Logger.get() })

    return new ConcurrencyTestApiServer({ server, accountsRepository })
  }

  private constructor({ server, accountsRepository }: { server: ForkedServer; accountsRepository: AccountsRepository }) {
    this.server = server
    this.accountsRepository = accountsRepository
  }

  public async createClient(args: { authenticated: true; alias?: string }): Promise<AuthenticatedApiClient>
  public async createClient(args: { authenticated: false }): Promise<AnonymousApiClient>
  public async createClient({
    authenticated,
    alias,
  }: {
    authenticated: boolean
    alias?: string
  }): Promise<AuthenticatedApiClient | AnonymousApiClient> {
    return await createApiClient({ port: this.server.port, accountsRepository: this.accountsRepository, authenticated, alias })
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    if (API_LOGS === "inherit") {
      await setTimeout(100)
    }

    await this.server.stop()
  }
}

type ForkedServer = {
  port: number
  stop: () => Promise<void>
}

async function forkApiServer({ databaseUrl }: { databaseUrl: string }): Promise<ForkedServer> {
  const apiProcess = fork("src/api/entry.api.ts", {
    cwd: process.cwd(),
    detached: true,
    env: {
      AUTH_SERVICE: AuthProviderKind.TEST_HEADER,
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
    apiReady.resolve(PortListeningMessageSchema.parse(message).port)
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
