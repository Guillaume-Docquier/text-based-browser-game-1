import { useMutation } from "@tanstack/react-query"
import { useBackendApiClient } from "./BackendApiClientContext.tsx"

// oxlint-disable-next-line typescript/explicit-function-return-type -- Let tRPC and TanStack Query inference do the work
export function useJoinGameMutation() {
  const backendApiClient = useBackendApiClient()

  return useMutation(backendApiClient.lobbies.join.mutationOptions())
}
