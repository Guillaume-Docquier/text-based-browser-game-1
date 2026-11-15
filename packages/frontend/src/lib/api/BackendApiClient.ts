import type { TrpcRouter } from "@api-types"
import type { Logger } from "@guillaume-docquier/tools-ts"
import type { QueryClient } from "@tanstack/react-query"
import { createTRPCClient, httpBatchLink, loggerLink } from "@trpc/client"
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query"
import { unlessProtected } from "@/lib/api/queryInvalidation.ts"

export type BackendApiClient = ReturnType<typeof createBackendApiClient>
// oxlint-disable-next-line typescript/explicit-function-return-type -- Let trpc inference do the work
export function createBackendApiClient({
  baseUrl,
  queryClient,
  logger,
  isDevelopment,
}: {
  baseUrl: string
  queryClient: QueryClient
  logger: Logger
  isDevelopment: boolean
}) {
  return createTRPCOptionsProxy<TrpcRouter>({
    client: createTRPCClient<TrpcRouter>({
      links: [
        loggerLink({
          enabled: (opts) => isDevelopment || (opts.direction === "down" && opts.result instanceof Error),
          logger: (opts) => {
            const context = {
              requestId: opts.id,
              path: opts.path,
              type: opts.type,
              ...(isDevelopment ? { input: opts.input } : {}),
            }

            if (opts.direction === "up") {
              logger.info("API request started", context)
              return
            }

            if (opts.result instanceof Error) {
              logger.error("API request failed", {
                ...context,
                elapsedMs: opts.elapsedMs,
                error: opts.result.message,
                code: opts.result.data?.code,
                stack: opts.result.stack,
              })
              return
            }

            logger.info("API request completed", {
              ...context,
              elapsedMs: opts.elapsedMs,
              result: opts.result.result,
            })
          },
        }),
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

          // Invalidate all ordinary queries in the react-query cache:
          await opts.queryClient.invalidateQueries({ predicate: unlessProtected })
        },
      },
    },
  })
}
