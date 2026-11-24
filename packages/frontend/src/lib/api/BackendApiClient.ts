import type { TrpcRouter } from "@api-types"
import type { Logger } from "@guillaume-docquier/tools-ts"
import type { QueryClient } from "@tanstack/react-query"
import { createTRPCClient, createWSClient, httpBatchLink, loggerLink, splitLink, wsLink } from "@trpc/client"
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query"
import { unlessProtected } from "@/lib/api/queryInvalidation.ts"

export type BackendApiClient = ReturnType<typeof createBackendApiClient>
// oxlint-disable-next-line typescript/explicit-function-return-type -- Let trpc inference do the work
export function createBackendApiClient({
  baseUrl,
  queryClient,
  logger,
  isDevelopment,
  getSessionToken,
}: {
  baseUrl: string
  queryClient: QueryClient
  logger: Logger
  isDevelopment: boolean
  getSessionToken?: () => Promise<string | null>
}) {
  const trpcUrl = `${baseUrl}/trpc`
  const webSocketUrl = new URL(trpcUrl, window.location.origin)
  webSocketUrl.protocol = webSocketUrl.protocol === "https:" ? "wss:" : "ws:"
  const webSocketClient = createWSClient({
    url: webSocketUrl.toString(),
    // CONSTRAINT: tRPC re-arms this timer while a subscription is active.
    lazy: { enabled: true, closeMs: 10_000 },
    connectionParams: async () => {
      const token = await getSessionToken?.()
      return token === undefined || token === null ? null : { token }
    },
  })

  return createTRPCOptionsProxy<TrpcRouter>({
    client: createTRPCClient<TrpcRouter>({
      links: [
        loggerLink({
          enabled: (opts) => isDevelopment || (opts.direction === "down" && opts.result instanceof Error),
          logger: (opts) => {
            const context: {
              requestId: number
              path: string
              type: "mutation" | "query" | "subscription"
              input?: unknown
            } = {
              requestId: opts.id,
              path: opts.path,
              type: opts.type,
            }

            if (isDevelopment) {
              context.input = opts.input
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
        splitLink({
          condition: ({ type }) => type === "subscription",
          true: wsLink({ client: webSocketClient }),
          false: httpBatchLink({ url: trpcUrl }),
        }),
      ],
    }),
    queryClient,
    overrides: {
      // CONSTRAINT: There is no way to invalidate a whole router on mutation. See https://trpc.io/docs/client/react/useUtils#invalidate-full-cache-on-every-mutation and https://github.com/trpc/trpc/issues/5264. Invalidating everything should be better than manually remembering to invalidate on every mutation.
      mutations: {
        async onSuccess(opts) {
          // CONSTRAINT: The order matters to allow route changes in `onSuccess` without having a flash of content change whilst redirecting.
          await opts.originalFn()
          await opts.queryClient.invalidateQueries({ predicate: unlessProtected })
        },
      },
    },
  })
}
