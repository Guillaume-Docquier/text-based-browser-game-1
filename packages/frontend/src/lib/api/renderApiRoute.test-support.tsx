import { Logger } from "@guillaume-docquier/tools-ts"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactElement } from "react"
import { renderRoute } from "@/lib/renderRoute.test-support.tsx"
import { createBackendApiClient } from "./BackendApiClient.ts"
import { BackendApiClientProvider } from "./BackendApiClientContext.tsx"

export function renderApiRoute(page: ReactElement): QueryClient {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const api = createBackendApiClient({ baseUrl: location.origin, queryClient, logger: Logger.get(), isDevelopment: false })
  renderRoute(
    <QueryClientProvider client={queryClient}>
      <BackendApiClientProvider backendApiClient={api}>{page}</BackendApiClientProvider>
    </QueryClientProvider>,
  )
  return queryClient
}
