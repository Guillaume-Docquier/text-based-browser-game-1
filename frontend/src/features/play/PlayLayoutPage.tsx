import { useQuery } from "@tanstack/react-query"
import { Navigate, Outlet } from "@tanstack/react-router"
import type { ReactElement } from "react"
import { GameLayout, GameLayoutSkeleton } from "./components/GameLayout.tsx"
import { useBackendApiClient } from "../../lib/api/BackendApiClientContext.tsx"
import { useLogger } from "../../lib/LoggerContext.tsx"
import { PlayGameContextProvider, type PlayGameContextValue } from "./PlayContext.tsx"

export function PlayLayoutPage({ gameId }: { gameId: number }): ReactElement {
  const logger = useLogger()
  const backendApiClient = useBackendApiClient()
  const gameQuery = useQuery(backendApiClient.games.getSummaryById.queryOptions({ gameId }))
  const gameStateQuery = useQuery(backendApiClient.gameStates.getById.queryOptions({ gameId }))

  if (gameQuery.isPending || gameStateQuery.isPending) {
    return <GameLayoutSkeleton />
  }

  if (gameQuery.isError) {
    logger.error("Could not fetch game", { gameId, error: gameQuery.error.message })
    return <Navigate to="/games" />
  }

  if (gameStateQuery.isError) {
    logger.error("Could not fetch game state", { gameId, error: gameStateQuery.error.message })
    return <Navigate to="/games" />
  }

  const context: PlayGameContextValue = { game: gameQuery.data.game, gameState: gameStateQuery.data.gameState }

  return (
    <PlayGameContextProvider value={context}>
      <GameLayout game={context.game} gameState={context.gameState}>
        <Outlet />
      </GameLayout>
    </PlayGameContextProvider>
  )
}
