import { Logger } from "@guillaume-docquier/tools-ts"
import { type QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { type PropsWithChildren, type ReactElement, useState } from "react"
import { createBackendApiClient } from "./BackendApiClient.ts"
import { BackendApiClientProvider } from "./BackendApiClientContext.tsx"

export function ApiTestProvider({ children, queryClient }: PropsWithChildren<{ queryClient: QueryClient }>): ReactElement {
  const [client] = useState(() =>
    createBackendApiClient({ baseUrl: location.origin, queryClient, logger: Logger.get(), isDevelopment: false }),
  )
  return (
    <QueryClientProvider client={queryClient}>
      <BackendApiClientProvider backendApiClient={client}>{children}</BackendApiClientProvider>
    </QueryClientProvider>
  )
}
