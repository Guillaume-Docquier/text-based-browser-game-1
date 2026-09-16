import type { TrpcRouter } from "@api-types"
import type { QueryClient } from "@tanstack/react-query"
import { createTRPCClient, httpBatchLink } from "@trpc/client"
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query"

type TrpcClient = ReturnType<typeof createTRPCClient<TrpcRouter>>

// oxlint-disable-next-line typescript/explicit-function-return-type -- Let tRPC inference do the work
function createMutationOverrides() {
  return {
    mutations: {
      async onSuccess({ originalFn, queryClient }: { originalFn: () => Promise<void> | void; queryClient: QueryClient }): Promise<void> {
        await originalFn()
        await queryClient.invalidateQueries({
          predicate: (query) => query.meta?.skipMutationInvalidation !== true,
        })
      },
    },
  }
}

// oxlint-disable-next-line typescript/explicit-function-return-type -- Let tRPC inference do the work
function createUnscopedApiClient({ client, queryClient }: { client: TrpcClient; queryClient: QueryClient }) {
  return createTRPCOptionsProxy<TrpcRouter>({
    client,
    queryClient,
    overrides: createMutationOverrides(),
  })
}

// oxlint-disable-next-line typescript/explicit-function-return-type -- Let tRPC inference do the work
function createUserApiClient({ client, queryClient, userId }: { client: TrpcClient; queryClient: QueryClient; userId: string }) {
  return createTRPCOptionsProxy<TrpcRouter, { keyPrefix: true }>({
    client,
    queryClient,
    keyPrefix: userId,
    overrides: createMutationOverrides(),
  })
}

export type BackendApiClient = ReturnType<typeof createBackendApiClient>
// oxlint-disable-next-line typescript/explicit-function-return-type -- Let tRPC and TanStack Query inference do the work
export function createBackendApiClient({ baseUrl, queryClient }: { baseUrl: string; queryClient: QueryClient }) {
  const client = createTRPCClient<TrpcRouter>({
    links: [
      httpBatchLink({
        url: baseUrl + "/trpc",
      }),
    ],
  })
  const unscopedApiClient = createUnscopedApiClient({ client, queryClient })

  return {
    unscoped: unscopedApiClient,
    // oxlint-disable-next-line typescript/explicit-function-return-type -- Let tRPC inference do the work
    forUser: (userId: string) => createUserApiClient({ client, queryClient, userId }),
  }
}
