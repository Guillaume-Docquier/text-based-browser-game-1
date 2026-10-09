import type { GameId } from "@api-types"
import { Outlet } from "@tanstack/react-router"
import type { ReactElement } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/alert.tsx"
import { Button } from "@/components/button.tsx"
import { PageHeader } from "@/features/PageHeader.tsx"
import { GameLayout, GameLayoutSkeleton } from "@/features/play/components/GameLayout.tsx"
import { PlayGameContextProvider, type PlayGameContextValue } from "@/features/play/PlayContext.tsx"
import { useGameDetailsQuery } from "@/lib/api/useGameDetailsQuery.ts"
import { usePlayerViewQuery } from "@/lib/api/usePlayerViewQuery.ts"
import { useLogger } from "@/lib/LoggerContext.tsx"

export function PlayGameLayout({ gameId }: { gameId: GameId }): ReactElement {
  const logger = useLogger()
  const gameQuery = useGameDetailsQuery(gameId)
  const playerViewQuery = usePlayerViewQuery(gameId)

  if (gameQuery.isPending || playerViewQuery.isPending) {
    return <GameLayoutSkeleton />
  }

  if (gameQuery.isError) {
    logger.error("Could not fetch game", { gameId, error: gameQuery.error.message })
    return (
      <GameLoadError
        message={gameQuery.error.message ?? "Please try again."}
        onRetry={() => {
          void gameQuery.refetch()
        }}
      />
    )
  }

  if (playerViewQuery.isError) {
    logger.error("Could not fetch game state", { gameId, error: playerViewQuery.error.message })
    return (
      <GameLoadError
        message={playerViewQuery.error.message ?? "Please try again."}
        onRetry={() => {
          void playerViewQuery.refetch()
        }}
      />
    )
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

function GameLoadError({ message, onRetry }: { message: string; onRetry: () => void }): ReactElement {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-4 py-12">
      <PageHeader title="Could not load game" />
      <Alert variant="destructive">
        <AlertTitle>Game data is unavailable</AlertTitle>
        <AlertDescription>{message}</AlertDescription>
      </Alert>
      <Button className="self-start" onClick={onRetry}>
        Retry
      </Button>
    </main>
  )
}
