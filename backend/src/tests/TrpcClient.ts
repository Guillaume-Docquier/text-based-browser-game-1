import { createTRPCClient, httpBatchLink } from "@trpc/client"
import { createServer } from "http"
import type { TrpcRouter } from "#api/createApi.ts"
import type { Express } from "express"
import type { AddressInfo } from "node:net"

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
 * const api = await createApiStub()
 * using trcpClient = new TrpcClient({ api })
 * ```
 */
export class TrpcClient {
  public readonly client
  private readonly server

  public constructor({ api }: { api: Express }) {
    this.server = createServer(api)
    this.server.listen(ANY_UNUSED_PORT)
    const address = this.server.address() as AddressInfo

    this.client = createTRPCClient<TrpcRouter>({
      links: [httpBatchLink({ url: `http://localhost:${address.port}/trpc` })],
    })
  }

  public [Symbol.dispose](): void {
    this.server.closeAllConnections()
  }
}
