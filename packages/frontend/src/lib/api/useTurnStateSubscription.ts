import { useSubscription } from "@trpc/tanstack-react-query"
import { useState } from "react"
import type { GameId } from "shared/domain/games/GameId.ts"
import { useBackendApiClient } from "@/lib/api/BackendApiClientContext.tsx"

// oxlint-disable-next-line typescript/explicit-function-return-type -- Let tRPC infer the subscription result.
export function useTurnStateSubscription(gameId: GameId) {
  const api = useBackendApiClient()
  const [hasLiveSnapshot, setHasLiveSnapshot] = useState(false)
  const subscription = useSubscription(
    api.gameplay.turnState.subscriptionOptions(
      { gameId },
      {
        onConnectionStateChange: ({ state }) => {
          if (state !== "pending") {
            setHasLiveSnapshot(false)
          }
        },
        onData: () => {
          setHasLiveSnapshot(true)
        },
      },
    ),
  )
  return { subscription, hasLiveSnapshot: hasLiveSnapshot && subscription.status === "pending" }
}
