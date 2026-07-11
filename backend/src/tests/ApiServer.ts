import { createServer, type Server } from "node:http"
import type { AddressInfo } from "node:net"
import type { TRPCClient } from "@trpc/client"
import type { Express } from "express"
import type { AccountModel, AccountsRepository } from "#api/accounts/accounts.repository.ts"
import { createNewAccountModelStub } from "#api/accounts/NewAccountModel.stub.ts"
import type { TrpcRouter } from "#api/createApi.ts"
import { extractSuccess } from "#tests/extractSuccess.ts"
import { TrpcClient } from "#tests/TrpcClient.ts"

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

/**
 * Creates a Trpc server with a client for testing.
 * This method will bootstrap the api as well and clean it up after the test.
 * Must be used with `using`
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
    if (!authenticated) {
      return {
        client: TrpcClient.create({ port: this.port, authId: undefined }),
        account: undefined,
      }
    }

    const account = extractSuccess(await this.accountsRepository.createAccount(createNewAccountModelStub()))

    return {
      client: TrpcClient.create({ port: this.port, authId: account.authId }),
      account,
    }
  }

  public [Symbol.dispose](): void {
    this.server.closeAllConnections()
  }
}
