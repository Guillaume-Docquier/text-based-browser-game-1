import type { TurnState } from "@api-types"
import { useSubscription } from "@trpc/tanstack-react-query"
import { useState } from "react"
import type { GameId } from "shared/domain/games/GameId.ts"
import { useBackendApiClient } from "@/lib/api/BackendApiClientContext.tsx"

export function useTurnState(gameId: GameId): { turnState: TurnState | undefined; isLive: boolean } {
  const backendApiClient = useBackendApiClient()
  const [isLive, setIsLive] = useState(false)
  const subscription = useSubscription(
    backendApiClient.gameplay.turnState.subscriptionOptions(
      { gameId },
      {
        onData: () => {
          setIsLive(true)
        },
        onError: () => {
          setIsLive(false)
        },
        onConnectionStateChange: ({ state }) => {
          if (state !== "pending") {
            setIsLive(false)
          }
        },
      },
    ),
  )

  return { turnState: subscription.data, isLive }
}
