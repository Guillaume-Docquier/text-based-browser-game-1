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
 * Handles cleanups via `using`
 *
 * @example
 * ```ts
 * using apiServer = new ApiServer(await createApiStub())
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
  private readonly port: number

  public constructor({ api, accountsRepository }: { api: Express; accountsRepository: AccountsRepository }) {
    this.accountsRepository = accountsRepository
    this.server = createServer(api).listen(ANY_UNUSED_PORT)
    this.port = (this.server.address() as AddressInfo).port
  }

  public async createClient(args: { authenticated: true }): Promise<AuthenticatedApiClient>
  public async createClient(args: { authenticated: false }): Promise<AnonymousApiClient>
  public async createClient({ authenticated }: { authenticated: boolean }): Promise<AuthenticatedApiClient | AnonymousApiClient> {
    return await createApiClient({ port: this.port, accountsRepository: this.accountsRepository, authenticated })
  }

  public [Symbol.dispose](): void {
    this.server.closeAllConnections()
    this.server.close()
  }
}
