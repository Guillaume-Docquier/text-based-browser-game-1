import type { GameDetails, PlayerView, TurnState } from "@api-types"
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
  return <PlayGame key={gameId} gameId={gameId} />
}

function PlayGame({ gameId }: { gameId: GameId }): ReactElement {
  const logger = useLogger()
  const gameDetailsQuery = useGameDetailsQuery(gameId)
  const { subscription, isLive } = useTurnState(gameId)
  const turnState = subscription.data
  const playerViewQuery = usePlayerViewQuery(gameId, turnState?.turn)

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
    return <GameLoadError message={subscription.error.message} onRetry={subscription.reset} />
  }

  if (turnState === undefined) {
    return <GameLayoutSkeleton />
  }

  return <LoadedPlayGame gameDetails={gameDetailsQuery.data} playerView={playerViewQuery.data} turnState={turnState} isLive={isLive} />
}

function LoadedPlayGame({
  gameDetails,
  playerView,
  turnState,
  isLive,
}: {
  gameDetails: GameDetails
  playerView: PlayerView
  turnState: TurnState
  isLive: boolean
}): ReactElement {
  const [currentTime, setCurrentTime] = useState(Date.now)

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now())
    }, 1_000)
    return (): void => {
      clearInterval(timer)
    }
  }, [])

  const isCurrentTurn = isLive && turnState.turn === playerView.turn
  const turnEndsAt = new Date(turnState.turnEndsAt).getTime()
  const isTurnOpen = turnState.turnStatus === TurnStatus.COLLECTING_ACTIONS && currentTime < turnEndsAt
  const canUpdateReadiness = isCurrentTurn && isTurnOpen && gameDetails.status !== GameStatus.ENDED

  const context: PlayGameContextValue = { gameDetails, playerView, turnState, canUpdateReadiness }

  return (
    <PlayGameContextProvider value={context}>
      <GameLayout game={context} currentTime={currentTime}>
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
