import { createServer, type Server } from "node:http"
import type { AddressInfo } from "node:net"
import type { AccountsRepository } from "#api/accounts/accounts.repository.ts"
import type { Api } from "#api/createApi.ts"
import { type AnonymousApiClient, type AuthenticatedApiClient, createApiClient } from "#testing/ApiClient.ts"

export class ApiServer {
  private readonly accountsRepository: AccountsRepository
  private readonly server: Server
  private readonly port: number
  private readonly closeWebSocket: () => void

  public constructor({
    api,
    attachWebSocket,
    accountsRepository,
  }: Pick<Api, "api" | "attachWebSocket"> & { accountsRepository: AccountsRepository }) {
    this.accountsRepository = accountsRepository
    this.server = createServer(api).listen()
    this.closeWebSocket = attachWebSocket(this.server)
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- I don't know when it's not actually an AddressInfo
    this.port = (this.server.address() as AddressInfo).port
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
    return await createApiClient({ port: this.port, accountsRepository: this.accountsRepository, authenticated, id })
  }

  public [Symbol.dispose](): void {
    this.closeWebSocket()
    this.server.closeAllConnections()
    this.server.close()
  }
}
