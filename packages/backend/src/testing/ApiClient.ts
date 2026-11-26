import { createTRPCClient, httpBatchLink, httpSubscriptionLink, splitLink, type TRPCClient } from "@trpc/client"
import { EventSource } from "eventsource"
import { createAccountStub } from "shared/domain/accounts/Account.stub.ts"
import type { Account } from "shared/domain/accounts/Account.ts"
import { v4 } from "uuid"
import type { AccountsRepository } from "#api/accounts/accounts.repository.ts"
import { AUTH_ID_HEADER } from "#api/auth/TestHeaderAuthProvider.ts"
import type { TrpcRouter } from "#api/createApi.ts"
import { extractSuccess } from "#testing/extractSuccess.ts"

export type AuthenticatedApiClient = {
  readonly client: TRPCClient<TrpcRouter>
  readonly account: Account
}

export type AnonymousApiClient = {
  readonly client: TRPCClient<TrpcRouter>
  readonly account: undefined
}

type CreateApiClientArgs = {
  port: number
  accountsRepository: AccountsRepository
  id?: string | undefined
  alias?: string | undefined
  authenticated: boolean
}

export async function createApiClient({
  authenticated,
  port,
  accountsRepository,
  id,
  alias,
}: CreateApiClientArgs): Promise<AuthenticatedApiClient | AnonymousApiClient> {
  if (!authenticated) {
    return {
      client: createTrpcClient({ port, authId: undefined }),
      account: undefined,
    }
  }

  const account = extractSuccess(
    await accountsRepository.createAccount(
      createAccountStub({
        id: id ?? v4(),
        alias: alias ?? v4(),
      }),
    ),
  )

  return {
    client: createTrpcClient({ port, authId: account.authId }),
    account,
  }
}

function createTrpcClient({ port, authId }: { port: number; authId: string | undefined }): TRPCClient<TrpcRouter> {
  const url = `http://localhost:${port}/trpc`
  // CONSTRAINT: The AUTH_ID_HEADER is serialized as "undefined" if the value is undefined. We have to avoid setting it when there is no account
  const headers = authId === undefined ? {} : { [AUTH_ID_HEADER]: authId }

  return createTRPCClient<TrpcRouter>({
    links: [
      splitLink({
        condition: (operation) => operation.type === "subscription",
        true: httpSubscriptionLink({
          url,
          EventSource,
          eventSourceOptions: {
            fetch: async (input, init) => await fetch(input, { ...init, headers: { ...init.headers, ...headers } }),
          },
        }),
        false: httpBatchLink({ url, headers }),
      }),
    ],
  })
}
