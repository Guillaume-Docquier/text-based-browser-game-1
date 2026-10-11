import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useBackendApiClient } from "@/lib/api/BackendApiClientContext.tsx"

// oxlint-disable-next-line typescript/explicit-function-return-type -- Let tRPC and TanStack Query inference do the work
export function useUpdateActionSubmission() {
  const backendApiClient = useBackendApiClient()

  const queryClient = useQueryClient()
  return useMutation(
    backendApiClient.gameplay.updateActionSubmission.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: backendApiClient.gameplay.getPlayerView.queryKey() })
      },
    }),
  )
}
