import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useBackendApiClient } from "@/lib/api/BackendApiClientContext.tsx"
import { skipGlobalInvalidationMeta } from "@/lib/api/queryInvalidation.ts"

// oxlint-disable-next-line typescript/explicit-function-return-type -- Let tRPC and TanStack Query inference do the work
export function useOnboarding({ enabled }: { enabled: boolean }) {
  const backendApiClient = useBackendApiClient()
  const queryClient = useQueryClient()

  const isOnboardedQueryOptions = backendApiClient.accounts.isOnboarded.queryOptions()
  const isOnboardedQuery = useQuery({
    ...isOnboardedQueryOptions,
    enabled,
    // This query is only invalidated on logout and doesn't retry in case of failure.
    // Onboarding is not critical, and if the query failed, a lot of other things will fail.
    staleTime: Infinity,
    gcTime: Infinity,
    meta: skipGlobalInvalidationMeta,
    refetchInterval: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
    retry: false,
    retryOnMount: false,
  })
  const finishOnboardingMutation = useMutation(
    backendApiClient.accounts.finishOnboarding.mutationOptions({
      onSuccess: () => {
        // isOnboardedQuery is intentionally never invalidated, so we set the data ourselves
        queryClient.setQueryData(isOnboardedQueryOptions.queryKey, true)
      },
    }),
  )

  return {
    isOnboarded: isOnboardedQuery.data,
    finishOnboarding: (alias: string): void => {
      finishOnboardingMutation.mutate({ alias })
    },
    isFinishing: finishOnboardingMutation.isPending,
    finishError: finishOnboardingMutation.error,
    resetFinishError: finishOnboardingMutation.reset,
  }
}
