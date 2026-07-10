import { createServer } from "http"
import type { AddressInfo } from "node:net"
import type { TRPCClient } from "@trpc/client"
import type { Express } from "express"
import type { AccountModel } from "#api/accounts/accounts.repository.ts"
import type { TrpcRouter } from "#api/createApi.ts"
import { TrpcClient } from "#tests/TrpcClient.ts"

/**
 * I can't find the documentation, but server.listen(0) gets assigned an unused port.
 * Great for testing.
 */
const ANY_UNUSED_PORT = 0

/**
 * Creates a Trpc server with a client for testing.
 * This method will bootstrap the api as well and clean it up after the test.
 * Must be used with `using`
 *
 * @example
 * ```ts
 * const { api, accountsRepository } = await createApiStub()
 * using apiServer = new ApiServer({ api, account: creatorAccount })
 *
 * const creatorAccount = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))
 * const trpcClient = apiServer.createClient({ account: creatorAccount })
 * ```
 */
export class ApiServer {
  private readonly server
  private readonly port: number

  public constructor({ api }: { api: Express }) {
    this.server = createServer(api)
    this.server.listen(ANY_UNUSED_PORT)
    this.port = (this.server.address() as AddressInfo).port
  }

  public createClient({ account }: { account?: AccountModel } = {}): TRPCClient<TrpcRouter> {
    return TrpcClient.create({ port: this.port, authId: account?.authId })
  }

  public [Symbol.dispose](): void {
    this.server.closeAllConnections()
  }
}
