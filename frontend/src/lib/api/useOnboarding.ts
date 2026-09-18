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
    retry: 3,
    retryDelay: exponentialBackoff({ minMs: 1_000, maxMs: 30_000 }),
    // This query is only invalidated on logout.
    staleTime: Infinity,
    gcTime: Infinity,
    meta: skipGlobalInvalidationMeta,
    refetchInterval: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
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
    finishOnboarding: ({ alias }: { alias: string }): void => {
      finishOnboardingMutation.mutate({ alias })
    },
    isFinishingOnboarding: finishOnboardingMutation.isPending,
    finishOnboardingError: finishOnboardingMutation.error,
    resetFinishOnboardingError: finishOnboardingMutation.reset,
  }
}

function exponentialBackoff({ minMs, maxMs }: { minMs: number; maxMs: number }): (attemptIndex: number) => number {
  return (attemptIndex: number) => Math.min(minMs * 2 ** attemptIndex, maxMs)
}
