import { once } from "node:events"
import { createServer, type Server } from "node:http"
import type { AddressInfo } from "node:net"
import type { Express } from "express"
import type { AccountsRepository } from "#api/accounts/accounts.repository.ts"
import { type AnonymousApiClient, type AuthenticatedApiClient, createApiClient } from "#tests/ApiClient.ts"

/**
 * I can't find the documentation, but server.listen(0) gets assigned an unused port.
 * Great for testing.
 */
const ANY_UNUSED_PORT = 0

/**
 * An api server that lets you create trpc clients for testing.
 * Awaits HTTP shutdown via `await using` before the integration fixture closes its databases.
 *
 * @example
 * ```ts
 * await using apiServer = new ApiServer(await createApiStub({db}))
 *
 * const player = await apiServer.createClient({ authenticated: true })
 * // player.account -> defined
 * // player.client
 *
 * const anonymous = await apiServer.createClient({ authenticated: false })
 * // anonymous.account -> undefined
 * // anonymous.client
 * ```
 */
export class ApiServer {
  private readonly accountsRepository: AccountsRepository
  private readonly server: Server
  private readonly listening: Promise<unknown[]>

  public constructor({ api, accountsRepository }: { api: Express; accountsRepository: AccountsRepository }) {
    this.accountsRepository = accountsRepository
    this.server = createServer(api).listen(ANY_UNUSED_PORT, "127.0.0.1")
    this.listening = once(this.server, "listening")
  }

  public async createClient(args: { authenticated: true; id?: string }): Promise<AuthenticatedApiClient>
  public async createClient(args: { authenticated: false }): Promise<AnonymousApiClient>
  public async createClient({
    authenticated,
    id,
  }: {
    authenticated: boolean
    id?: string | undefined
  }): Promise<AuthenticatedApiClient | AnonymousApiClient> {
    await this.listening
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- I don't know when it's not actually an AddressInfo
    const { port } = this.server.address() as AddressInfo
    return await createApiClient({ port, accountsRepository: this.accountsRepository, authenticated, id })
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    this.server.closeAllConnections()
    await this.server[Symbol.asyncDispose]()
  }
}
