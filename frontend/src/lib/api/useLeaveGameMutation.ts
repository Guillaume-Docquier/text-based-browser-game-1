import { useMutation } from "@tanstack/react-query"
import { useBackendApiClient } from "./BackendApiClientContext.tsx"

// oxlint-disable-next-line typescript/explicit-function-return-type -- Let tRPC and TanStack Query inference do the work
export function useLeaveGameMutation() {
  const backendApiClient = useBackendApiClient()

  return useMutation(backendApiClient.lobbies.leave.mutationOptions())
}
