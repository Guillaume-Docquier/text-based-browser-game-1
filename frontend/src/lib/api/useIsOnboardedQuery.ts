import { useQuery } from "@tanstack/react-query"
import { useBackendApiClient } from "@/lib/api/BackendApiClientContext.tsx"

// oxlint-disable-next-line typescript/explicit-function-return-type -- Let tRPC and TanStack Query inference do the work
export function useIsOnboardedQuery() {
  const backendApiClient = useBackendApiClient()

  return useQuery({
    ...backendApiClient.accounts.isOnboarded.queryOptions(),
    staleTime: Infinity,
    gcTime: Infinity,
    meta: { skipMutationInvalidation: true },
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
    retry: false,
    retryOnMount: false,
  })
}
