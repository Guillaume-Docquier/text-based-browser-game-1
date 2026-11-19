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
        httpBatchLink({
          url: `${baseUrl}/trpc`,
        }),
      ],
    }),
    queryClient,
    overrides: {
      mutations: {
        async onSuccess(opts) {
          await opts.originalFn()

          await opts.queryClient.invalidateQueries({ predicate: unlessProtected })
        },
      },
    },
  })
}
