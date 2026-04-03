import type { AppRouter } from "@api-types"
import type { QueryClient } from "@tanstack/react-query"
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query"
import { createTRPCClient, httpBatchLink } from "@trpc/client"

export type BackendApiClient = ReturnType<typeof createBackendApiClient>
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- Let trpc inference do the work
export function createBackendApiClient({ queryClient }: { queryClient: QueryClient }) {
  return createTRPCOptionsProxy<AppRouter>({
    client: createTRPCClient<AppRouter>({
      links: [
        httpBatchLink({
          url: "/api/trpc",
        }),
      ],
    }),
    queryClient,
  })
}
