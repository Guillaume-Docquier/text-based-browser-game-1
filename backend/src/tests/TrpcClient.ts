import { createTRPCClient, httpBatchLink, type TRPCClient } from "@trpc/client"
import { AUTH_ID_HEADER } from "#api/accounts/TestHeaderAuthProvider.ts"
import type { TrpcRouter } from "#api/createApi.ts"

export const TrpcClient = {
  /**
   * Creates a test trpc client.
   * You can provide an authId to create an authenticated client via {@link TestHeaderAuthProvider}
   */
  create: ({ port, authId }: { port: number; authId: string | undefined }): TRPCClient<TrpcRouter> => {
    return createTRPCClient<TrpcRouter>({
      links: [
        httpBatchLink({
          url: `http://localhost:${port}/trpc`,
          // The AUTH_ID_HEADER is serialized as "undefined" if the value is undefined
          // We have to avoid setting it when there is no account
          ...(authId === undefined ? {} : { headers: { [AUTH_ID_HEADER]: authId } }),
        }),
      ],
    })
  },
}
