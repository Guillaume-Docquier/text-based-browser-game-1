import { useQuery } from "@tanstack/react-query"
import { useBackendApiClient } from "./BackendApiClientContext.tsx"

// oxlint-disable-next-line typescript/explicit-function-return-type -- Let tRPC and TanStack Query inference do the work
export function useLobbyCreationSettingsQuery() {
  const backendApiClient = useBackendApiClient()

  return useQuery({
    ...backendApiClient.lobbies.getCreationSettings.queryOptions(),
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnMount: "always",
  })
}
