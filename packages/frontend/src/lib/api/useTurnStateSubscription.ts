import { useSubscription } from "@trpc/tanstack-react-query"
import type { GameId } from "shared/domain/games/GameId.ts"
import { useBackendApiClient } from "@/lib/api/BackendApiClientContext.tsx"

// oxlint-disable-next-line typescript/explicit-function-return-type -- Let tRPC infer the subscription result.
export function useTurnStateSubscription(gameId: GameId) {
  const api = useBackendApiClient()
  return useSubscription(api.gameplay.turnState.subscriptionOptions({ gameId }))
}
