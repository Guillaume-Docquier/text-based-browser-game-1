import { Logger } from "@guillaume-docquier/tools-ts"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from "@tanstack/react-router"
import type { ReactElement } from "react"
import { render, type RenderResult } from "vitest-browser-react"
import { createBackendApiClient } from "@/lib/api/BackendApiClient.ts"
import { BackendApiClientProvider } from "@/lib/api/BackendApiClientContext.tsx"

export async function renderApplicationPage(page: ReactElement, queryClient = new QueryClient()): Promise<RenderResult> {
  const router = createRouter({
    history: createMemoryHistory({ initialEntries: ["/"] }),
    routeTree: createRootRoute({ component: () => page }),
  })
  const backendApiClient = createBackendApiClient({ baseUrl: location.origin, queryClient, logger: Logger.get(), isDevelopment: false })
  await router.load()
  return await render(
    <QueryClientProvider client={queryClient}>
      <BackendApiClientProvider backendApiClient={backendApiClient}>
        <RouterProvider router={router} />
      </BackendApiClientProvider>
    </QueryClientProvider>,
  )
}
