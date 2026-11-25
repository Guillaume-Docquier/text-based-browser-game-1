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
  return createTRPCClient<TrpcRouter>({
    links: [
      splitLink({
        condition: ({ type }) => type === "subscription",
        true: httpSubscriptionLink({
          url: `http://localhost:${port}/trpc`,
          EventSource,
          eventSourceOptions: {
            fetch: async (input, init) => {
              const headers = new Headers(init?.headers)
              if (authId !== undefined) {
                headers.set(AUTH_ID_HEADER, authId)
              }
              return await fetch(input, { ...init, headers })
            },
          },
        }),
        false: httpBatchLink({
          url: `http://localhost:${port}/trpc`,
          // CONSTRAINT: An undefined AUTH_ID_HEADER would be serialized as the string "undefined".
          headers: authId === undefined ? {} : { [AUTH_ID_HEADER]: authId },
        }),
      }),
    ],
  })
}
