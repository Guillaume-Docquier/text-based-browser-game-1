import type { GameId } from "@api-types"
import { Navigate, Outlet } from "@tanstack/react-router"
import type { ReactElement } from "react"
import { useLobbyQuery } from "../../lib/api/useLobbyQuery.ts"
import { usePlayerViewQuery } from "../../lib/api/usePlayerViewQuery.ts"
import { useLogger } from "../../lib/LoggerContext.tsx"
import { GameLayout, GameLayoutSkeleton } from "./components/GameLayout.tsx"
import { PlayGameContextProvider, type PlayGameContextValue } from "./PlayContext.tsx"

export function PlayGameLayout({ gameId }: { gameId: GameId }): ReactElement {
  const logger = useLogger()
  const gameQuery = useLobbyQuery(gameId)
  const playerViewQuery = usePlayerViewQuery(gameId)

  if (gameQuery.isPending || playerViewQuery.isPending) {
    return <GameLayoutSkeleton />
  }

  if (gameQuery.isError) {
    logger.error("Could not fetch game", { gameId, error: gameQuery.error.message })
    return <Navigate to="/games" />
  }

  if (playerViewQuery.isError) {
    logger.error("Could not fetch game state", { gameId, error: playerViewQuery.error.message })
    return <Navigate to="/games" />
  }

  const context: PlayGameContextValue = { game: gameQuery.data, playerView: playerViewQuery.data }

  return (
    <PlayGameContextProvider value={context}>
      <GameLayout game={context.game} playerView={context.playerView}>
        <Outlet />
      </GameLayout>
    </PlayGameContextProvider>
  )
}
