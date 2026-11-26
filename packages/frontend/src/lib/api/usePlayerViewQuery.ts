import { useQuery } from "@tanstack/react-query"
import { useEffect } from "react"
import type { GameId } from "shared/domain/games/GameId.ts"
import { useBackendApiClient } from "@/lib/api/BackendApiClientContext.tsx"
import { protectAgainstInvalidationMeta } from "./queryInvalidation.ts"

// oxlint-disable-next-line typescript/explicit-function-return-type -- Let tRPC and TanStack Query inference do the work
export function usePlayerViewQuery(gameId: GameId, liveTurn: number | undefined) {
  const backendApiClient = useBackendApiClient()

  const query = useQuery(
    backendApiClient.gameplay.getPlayerView.queryOptions(
      { gameId },
      {
        staleTime: Infinity,
        meta: protectAgainstInvalidationMeta,
      },
    ),
  )

  const { refetch, fetchStatus } = query
  const needsRefresh = query.isSuccess && liveTurn !== undefined && query.data.turn < liveTurn
  useEffect(() => {
    if (needsRefresh && fetchStatus === "idle") {
      void refetch({ cancelRefetch: false })
    }
  }, [needsRefresh, fetchStatus, refetch])

  return query
}
