import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef } from "react"
import type { GameId } from "shared/domain/games/GameId.ts"
import { useBackendApiClient } from "@/lib/api/BackendApiClientContext.tsx"
import { protectAgainstInvalidationMeta } from "@/lib/api/queryInvalidation.ts"

// oxlint-disable-next-line typescript/explicit-function-return-type -- Let tRPC and TanStack Query inference do the work
export function usePlayerViewQuery(gameId: GameId, liveTurn: number | undefined) {
  const backendApiClient = useBackendApiClient()
  const queryClient = useQueryClient()
  const requestedTurn = useRef<number | undefined>(undefined)
  const playerView = backendApiClient.gameplay.getPlayerView
  const query = useQuery(
    playerView.queryOptions(
      { gameId },
      {
        staleTime: Infinity,
        meta: protectAgainstInvalidationMeta,
      },
    ),
  )

  const viewTurn = query.data?.turn
  const canRefresh = query.fetchStatus === "idle" && !query.isError
  useEffect(() => {
    if (!canRefresh || viewTurn === undefined || liveTurn === undefined || liveTurn <= viewTurn || requestedTurn.current === liveTurn) {
      return
    }

    requestedTurn.current = liveTurn
    void queryClient.invalidateQueries({ queryKey: playerView.queryKey({ gameId }), exact: true })
  }, [canRefresh, gameId, liveTurn, playerView, queryClient, viewTurn])

  return query
}
