import { useMutation } from "@tanstack/react-query"
import { useBackendApiClient } from "@/lib/api/BackendApiClientContext.tsx"

// oxlint-disable-next-line typescript/explicit-function-return-type -- Let tRPC and TanStack Query inference do the work
export function useSetReady() {
  const backendApiClient = useBackendApiClient()
  return useMutation(backendApiClient.gameplay.setReady.mutationOptions())
}
