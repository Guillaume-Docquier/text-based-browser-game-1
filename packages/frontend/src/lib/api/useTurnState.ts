import type { TurnState } from "@api-types"
import { onlineManager, useQuery } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import type { GameId } from "shared/domain/games/GameId.ts"
import { useBackendApiClient } from "@/lib/api/BackendApiClientContext.tsx"

export function useTurnState(gameId: GameId): {
  data: TurnState | undefined
  isLive: boolean
  error: { message: string } | null
  retry: () => void
} {
  const api = useBackendApiClient()
  const [connection, setConnection] = useState(() => ({ online: onlineManager.isOnline(), since: 0 }))
  const query = useQuery(api.gameplay.turnState.queryOptions({ gameId }, { refetchInterval: 1_000, refetchIntervalInBackground: true }))
  useEffect(
    () =>
      onlineManager.subscribe((online) => {
        setConnection({ online, since: Date.now() })
      }),
    [],
  )

  return {
    data: query.data,
    isLive: connection.online && query.isSuccess && query.isFetchedAfterMount && query.dataUpdatedAt >= connection.since,
    error: query.error,
    retry: () => {
      void query.refetch()
    },
  }
}
