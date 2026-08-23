import { useAuth } from "@clerk/react"
import { hashKey, useQuery } from "@tanstack/react-query"
import { useBackendApiClient } from "@/lib/api/BackendApiClientContext.tsx"

// oxlint-disable-next-line typescript/explicit-function-return-type -- Let tRPC and TanStack Query inference do the work
export function useListingsQuery() {
  const { userId } = useAuth()
  const backendApiClient = useBackendApiClient()
  const queryOptions = backendApiClient.listings.getListings.queryOptions()

  return useQuery({ ...queryOptions, queryKeyHashFn: (queryKey) => hashKey([queryKey, userId]) })
}
