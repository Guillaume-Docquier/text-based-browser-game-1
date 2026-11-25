import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef } from "react"
import type { GameId } from "shared/domain/games/GameId.ts"
import { useBackendApiClient } from "@/lib/api/BackendApiClientContext.tsx"
import { protectAgainstInvalidationMeta } from "@/lib/api/queryInvalidation.ts"

// oxlint-disable-next-line typescript/explicit-function-return-type -- Let tRPC and TanStack Query inference do the work
export function usePlayerViewQuery(gameId: GameId, liveTurn: number | undefined) {
  const backendApiClient = useBackendApiClient()
  const queryClient = useQueryClient()
  const refreshRequested = useRef<number | undefined>(undefined)
  const options = backendApiClient.gameplay.getPlayerView.queryOptions(
    { gameId },
    { staleTime: Infinity, meta: protectAgainstInvalidationMeta },
  )
  const query = useQuery(options)
  const worldTurn = query.data?.turn
  const fetchStatus = query.fetchStatus

  useEffect(() => {
    if (worldTurn === undefined || liveTurn === undefined || worldTurn >= liveTurn || fetchStatus !== "idle") {
      return
    }
    if (refreshRequested.current !== undefined && refreshRequested.current >= liveTurn) {
      return
    }

    refreshRequested.current = liveTurn
    void queryClient.invalidateQueries({ queryKey: options.queryKey, exact: true }, { cancelRefetch: false })
  }, [fetchStatus, liveTurn, options.queryKey, queryClient, worldTurn])

  return query
}
