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

  const { data, isSuccess, refetch, fetchStatus } = query
  const worldTurn = data?.turn
  useEffect(() => {
    if (isSuccess && fetchStatus === "idle" && worldTurn !== undefined && liveTurn !== undefined && worldTurn < liveTurn) {
      void refetch({ cancelRefetch: false })
    }
  }, [worldTurn, liveTurn, isSuccess, fetchStatus, refetch])

  return query
}
