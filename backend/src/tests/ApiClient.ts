import { createTRPCClient, httpBatchLink, type TRPCClient } from "@trpc/client"
import { type AccountModel, type AccountsRepository } from "#api/accounts/accounts.repository.ts"
import { createNewAccountModelStub } from "#api/accounts/NewAccountModel.stub.ts"
import { AUTH_ID_HEADER } from "#api/accounts/TestHeaderAuthProvider.ts"
import type { TrpcRouter } from "#api/createApi.ts"
import { extractSuccess } from "#tests/extractSuccess.ts"

export type AuthenticatedApiClient = {
  readonly client: TRPCClient<TrpcRouter>
  readonly account: AccountModel
}

export type AnonymousApiClient = {
  readonly client: TRPCClient<TrpcRouter>
  readonly account: undefined
}

type CreateApiClientArgs = {
  port: number
  accountsRepository: AccountsRepository
}

/**
 * A test utility to create a TrpcClient and an account at the same time.
 * If authenticated is true, an account is created, returned and the trpc client will be authenticated.
 */
export async function createApiClient({
  authenticated,
  port,
  accountsRepository,
}: CreateApiClientArgs & { authenticated: boolean }): Promise<AuthenticatedApiClient | AnonymousApiClient> {
  if (!authenticated) {
    return {
      client: createTrpcClient({ port, authId: undefined }),
      account: undefined,
    }
  }

  const account = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))

  return {
    client: createTrpcClient({ port, authId: account.authId }),
    account,
  }
}

/**
 * Creates a test trpc client.
 * You can provide an authId to create an authenticated client via {@link TestHeaderAuthProvider}
 */
function createTrpcClient({ port, authId }: { port: number; authId: string | undefined }): TRPCClient<TrpcRouter> {
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
}
