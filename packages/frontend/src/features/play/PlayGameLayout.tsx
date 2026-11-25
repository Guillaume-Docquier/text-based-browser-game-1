import { Outlet } from "@tanstack/react-router"
import { type ReactElement, useEffect, useState } from "react"
import type { GameId } from "shared/domain/games/GameId.ts"
import { GameStatus } from "shared/domain/games/GameStatus.ts"
import { TurnStatus } from "shared/domain/turns/TurnStatus.ts"
import { Alert, AlertDescription, AlertTitle } from "@/components/alert.tsx"
import { Button } from "@/components/button.tsx"
import { PageHeader } from "@/features/PageHeader.tsx"
import { GameLayout, GameLayoutSkeleton } from "@/features/play/components/GameLayout.tsx"
import { PlayGameContextProvider, type PlayGameContextValue } from "@/features/play/PlayContext.tsx"
import { useGameDetailsQuery } from "@/lib/api/useGameDetailsQuery.ts"
import { usePlayerViewQuery } from "@/lib/api/usePlayerViewQuery.ts"
import { useTurnState } from "@/lib/api/useTurnState.ts"
import { useLogger } from "@/lib/LoggerContext.tsx"

export function PlayGameLayout({ gameId }: { gameId: GameId }): ReactElement {
  const logger = useLogger()
  const gameDetailsQuery = useGameDetailsQuery(gameId)
  const turnState = useTurnState(gameId)
  const playerViewQuery = usePlayerViewQuery(gameId, turnState.data?.turn)
  if (gameDetailsQuery.isPending || playerViewQuery.isPending) {
    return <GameLayoutSkeleton />
  }

  if (gameDetailsQuery.isError) {
    logger.error("Could not fetch game", { gameId, error: gameDetailsQuery.error.message })
    return (
      <GameLoadError
        message={gameDetailsQuery.error.message ?? "Please try again."}
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
        message={playerViewQuery.error.message ?? "Please try again."}
        onRetry={() => {
          void playerViewQuery.refetch()
        }}
      />
    )
  }

  if (turnState.data === undefined) {
    return turnState.error === null ? <GameLayoutSkeleton /> : <GameLoadError message={turnState.error.message} onRetry={turnState.retry} />
  }

  return (
    <LoadedGame
      gameDetails={gameDetailsQuery.data}
      playerView={playerViewQuery.data}
      turnState={turnState.data}
      isLive={turnState.isLive}
    />
  )
}

function LoadedGame({
  gameDetails,
  playerView,
  turnState,
  isLive,
}: Omit<PlayGameContextValue, "canUpdateReadiness"> & { isLive: boolean }): ReactElement {
  const [currentTime, setCurrentTime] = useState(() => new Date())
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return (): void => {
      clearInterval(interval)
    }
  }, [])

  const turnIsOpen = turnState.turnStatus === TurnStatus.COLLECTING_ACTIONS && currentTime.getTime() < Date.parse(turnState.turnEndsAt)
  const worldIsCurrent = isLive && playerView.turn === turnState.turn
  const canUpdateReadiness = turnIsOpen && worldIsCurrent && gameDetails.status !== GameStatus.ENDED
  return (
    <PlayGameContextProvider value={{ gameDetails, playerView, turnState, canUpdateReadiness }}>
      <GameLayout gameId={gameDetails.id} currentTime={currentTime}>
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
