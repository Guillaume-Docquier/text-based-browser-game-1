import { useQuery } from "@tanstack/react-query"
import type { GameId } from "shared/domain/games/GameId.ts"
import { useBackendApiClient } from "@/lib/api/BackendApiClientContext.tsx"

// oxlint-disable-next-line typescript/explicit-function-return-type -- Let tRPC and TanStack Query inference do the work
export function useTurnStateQuery(gameId: GameId) {
  const api = useBackendApiClient()
  return useQuery(api.gameplay.turnState.queryOptions({ gameId }, { refetchInterval: 1_000, refetchIntervalInBackground: true }))
}
