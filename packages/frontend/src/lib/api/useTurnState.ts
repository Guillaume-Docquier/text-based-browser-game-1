import type { GameId } from "@api-types"
import { useSubscription } from "@trpc/tanstack-react-query"
import { useState } from "react"
import { useBackendApiClient } from "@/lib/api/BackendApiClientContext.tsx"

// oxlint-disable-next-line typescript/explicit-function-return-type -- Let tRPC and TanStack Query inference do the work
export function useTurnState(gameId: GameId) {
  const backendApiClient = useBackendApiClient()
  const [isLive, setIsLive] = useState(false)
  const subscription = useSubscription(
    backendApiClient.gameplay.turnState.subscriptionOptions(
      { gameId },
      {
        onData: () => {
          setIsLive(true)
        },
        onConnectionStateChange: ({ state }) => {
          if (state !== "pending") {
            setIsLive(false)
          }
        },
      },
    ),
  )

  return { subscription, isLive }
}
