import { Outlet } from "@tanstack/react-router"
import type { ReactElement } from "react"
import type { GameId } from "shared/domain/games/GameId.ts"
import { Alert, AlertDescription, AlertTitle } from "@/components/alert.tsx"
import { Button } from "@/components/button.tsx"
import { PageHeader } from "@/features/PageHeader.tsx"
import { GameLayout, GameLayoutSkeleton } from "@/features/play/components/GameLayout.tsx"
import { PlayGameContextProvider } from "@/features/play/PlayContext.tsx"
import { useGameDetailsQuery } from "@/lib/api/useGameDetailsQuery.ts"
import { usePlayerViewQuery } from "@/lib/api/usePlayerViewQuery.ts"
import { useTurnStateSubscription } from "@/lib/api/useTurnStateSubscription.ts"
import { useLogger } from "@/lib/LoggerContext.tsx"

export function PlayGameLayout({ gameId }: { gameId: GameId }): ReactElement {
  const logger = useLogger()
  const gameDetailsQuery = useGameDetailsQuery(gameId)
  const { subscription, hasLiveSnapshot } = useTurnStateSubscription(gameId)
  const playerViewQuery = usePlayerViewQuery(gameId, subscription.data?.turn)

  if (gameDetailsQuery.isPending || playerViewQuery.isPending) {
    return <GameLayoutSkeleton />
  }

  if (gameDetailsQuery.isError) {
    logger.error("Could not fetch game", { gameId, error: gameDetailsQuery.error.message })
    return (
      <GameLoadError
        message={gameDetailsQuery.error.message}
        onRetry={() => {
          void gameDetailsQuery.refetch()
        }}
      />
    )
  }

  if (playerViewQuery.isError) {
    logger.error("Could not fetch game state", { gameId, error: playerViewQuery.error.message })
    return (
      <GameLoadError
        message={playerViewQuery.error.message}
        onRetry={() => {
          void playerViewQuery.refetch()
        }}
      />
    )
  }

  if (subscription.status === "error") {
    logger.error("Could not fetch turn state", { gameId, error: subscription.error.message })
    return (
      <GameLoadError
        message={subscription.error.message}
        onRetry={() => {
          subscription.reset()
        }}
      />
    )
  }

  if (subscription.data === undefined) {
    return <GameLayoutSkeleton />
  }

  return (
    <PlayGameContextProvider
      hasLiveSnapshot={hasLiveSnapshot}
      gameDetails={gameDetailsQuery.data}
      playerView={playerViewQuery.data}
      turnState={subscription.data}
    >
      <GameLayout gameId={gameId}>
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
