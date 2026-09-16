import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useBackendApiClient } from "@/lib/api/BackendApiClientContext.tsx"

// oxlint-disable-next-line typescript/explicit-function-return-type -- Let tRPC and TanStack Query inference do the work
export function useFinishOnboardingMutation(userId: string) {
  const backendApiClient = useBackendApiClient()
  const queryClient = useQueryClient()
  const userApiClient = backendApiClient.forUser(userId)
  const mutationOptions = userApiClient.accounts.finishOnboarding.mutationOptions()

  return useMutation({
    ...mutationOptions,
    onSuccess: async (...args) => {
      await mutationOptions.onSuccess?.(...args)
      queryClient.setQueryData(userApiClient.accounts.isOnboarded.queryKey(), true)
    },
  })
}
