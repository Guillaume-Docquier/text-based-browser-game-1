import { createServer } from "http"
import type { AddressInfo } from "node:net"
import type { Express } from "express"
import type { AccountModel } from "#api/accounts/accounts.repository.ts"
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
 * const creatorAccount = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))
 * using trcpServer = new TrpcClient({ api, account: creatorAccount })
 * ```
 */
export class TrpcServer {
  public readonly client
  private readonly server

  public constructor({ api, account }: { api: Express; account?: AccountModel }) {
    this.server = createServer(api)
    this.server.listen(ANY_UNUSED_PORT)

    const serverAddress = this.server.address() as AddressInfo
    this.client = TrpcClient.create({ port: serverAddress.port, authId: account?.authId })
  }

  public [Symbol.dispose](): void {
    this.server.closeAllConnections()
  }
}
