import { createServer } from "http"
import type { AddressInfo } from "node:net"
import { createTRPCClient, httpBatchLink } from "@trpc/client"
import type { Express } from "express"
import type { AccountModel } from "#api/accounts/accounts.repository.ts"
import { AUTH_ID_HEADER } from "#api/accounts/TestHeaderAuthProvider.ts"
import type { TrpcRouter } from "#api/createApi.ts"

/**
 * I can't find the documentation, but server.listen(0) gets assigned an unused port.
 * Great for testing.
 */
const ANY_UNUSED_PORT = 0

/**
 * Creates a Trpc client for testing.
 * This method will bootstrap the api as well and clean it up after the test.
 * Must be used with `using`
 *
 * @example
 * ```ts
 * const { api, accountsRepository } = await createApiStub()
 * const creatorAccount = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))
 * using trcpClient = new TrpcClient({ api, account: creatorAccount })
 * ```
 */
export class TrpcClient {
  public readonly client
  private readonly server

  public constructor({ api, account }: { api: Express; account?: AccountModel }) {
    this.server = createServer(api)
    this.server.listen(ANY_UNUSED_PORT)
    const address = this.server.address() as AddressInfo

    this.client = createTRPCClient<TrpcRouter>({
      links: [
        httpBatchLink({
          url: `http://localhost:${address.port}/trpc`,
          // The AUTH_ID_HEADER is serialized as "undefined" if the value is undefined
          // We have to avoid setting it when there is no account
          ...(account === undefined ? {} : { headers: { [AUTH_ID_HEADER]: account.authId } }),
        }),
      ],
    })
  }

  public [Symbol.dispose](): void {
    this.server.closeAllConnections()
  }
}
