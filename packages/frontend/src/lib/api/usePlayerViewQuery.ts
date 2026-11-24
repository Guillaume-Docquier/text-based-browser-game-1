import { useQuery } from "@tanstack/react-query"
import type { GameId } from "shared/domain/games/GameId.ts"
import { useBackendApiClient } from "@/lib/api/BackendApiClientContext.tsx"

// oxlint-disable-next-line typescript/explicit-function-return-type -- Let tRPC and TanStack Query inference do the work
export function usePlayerViewQuery(gameId: GameId) {
  const backendApiClient = useBackendApiClient()

  return useQuery(
    backendApiClient.gameplay.getPlayerView.queryOptions(
      { gameId },
      {
        refetchInterval: 5_000,
      },
    ),
  )
}
