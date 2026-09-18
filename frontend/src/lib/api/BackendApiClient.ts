import type { TrpcRouter } from "@api-types"
import type { QueryClient } from "@tanstack/react-query"
import { createTRPCClient, httpBatchLink } from "@trpc/client"
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query"

export type BackendApiClient = ReturnType<typeof createBackendApiClient>
// oxlint-disable-next-line typescript/explicit-function-return-type -- Let trpc inference do the work
export function createBackendApiClient({ baseUrl, queryClient }: { baseUrl: string; queryClient: QueryClient }) {
  return createTRPCOptionsProxy<TrpcRouter>({
    client: createTRPCClient<TrpcRouter>({
      links: [
        httpBatchLink({
          url: `${baseUrl}/trpc`,
        }),
      ],
    }),
    queryClient,
    overrides: {
      /**
       * Invalidate full cache on every mutation
       * https://trpc.io/docs/client/react/useUtils#invalidate-full-cache-on-every-mutation
       *
       * This is probably a bit overkill, but there is no way to invalidate a whole router on mutation.
       * See: https://github.com/trpc/trpc/issues/5264
       *
       * Invalidating everything should be better than manually remembering to invalidate on every mutation.
       */
      mutations: {
        /**
         * This function is called whenever a `.useMutation` succeeds
         **/
        async onSuccess(opts) {
          /**
           * @note that order here matters:
           * The order here allows route changes in `onSuccess` without
           * having a flash of content change whilst redirecting.
           **/

          // Calls the `onSuccess` defined in the `useQuery()`-options:
          await opts.originalFn()

          // Invalidate all queries in the react-query cache:
          await opts.queryClient.invalidateQueries()
        },
      },
    },
  })
}
