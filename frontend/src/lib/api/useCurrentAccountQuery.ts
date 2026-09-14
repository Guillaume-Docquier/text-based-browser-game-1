import { useQuery } from "@tanstack/react-query"
import { useBackendApiClient } from "@/lib/api/BackendApiClientContext.tsx"

// oxlint-disable-next-line typescript/explicit-function-return-type -- Let tRPC and TanStack Query inference do the work
export function useCurrentAccountQuery() {
  const backendApiClient = useBackendApiClient()

  return useQuery({
    ...backendApiClient.accounts.getCurrent.queryOptions(),
    staleTime: Infinity,
    gcTime: Infinity,
  })
}
