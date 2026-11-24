import { useQuery } from "@tanstack/react-query"
import type { GameId } from "shared/domain/games/GameId.ts"
import { useBackendApiClient } from "@/lib/api/BackendApiClientContext.tsx"

// oxlint-disable-next-line typescript/explicit-function-return-type -- Let tRPC and TanStack Query inference do the work
export function useGameDetailsQuery(gameId: GameId) {
  const backendApiClient = useBackendApiClient()

  return useQuery(backendApiClient.games.getDetails.queryOptions({ gameId }))
}
