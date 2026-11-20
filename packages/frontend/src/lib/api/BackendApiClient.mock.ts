import type { TrpcRouter } from "@api-types"
import type { QueryClient } from "@tanstack/react-query"
import { createTRPCClient, httpLink } from "@trpc/client"
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query"
import type { BackendApiClient } from "./BackendApiClient.ts"

export function createOnboardingOutageApiMock(queryClient: QueryClient): {
  backendApiClient: BackendApiClient
  requests: Readonly<{ onboarding: number; listings: number }>
} {
  const requests = { onboarding: 0, listings: 0 }

  const client = createTRPCClient<TrpcRouter>({
    links: [
      httpLink({
        url: "https://cosmic-empires.test/trpc",
        fetch: async (input): Promise<Response> => {
          const path = new URL(input instanceof Request ? input.url : input).pathname

          switch (path) {
            case "/trpc/accounts.isOnboarded":
              requests.onboarding++
              return Response.json({ error: { code: -32603, message: "Onboarding status is unavailable" } }, { status: 500 })
            case "/trpc/games.getListings":
              requests.listings++
              return Response.json({ result: { data: [] } })
            default:
              throw new Error(`Unexpected test API request to ${path}`)
          }
        },
      }),
    ],
  })

  return { backendApiClient: createTRPCOptionsProxy<TrpcRouter>({ client, queryClient }), requests }
}
