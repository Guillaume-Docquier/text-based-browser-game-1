import type { TurnState } from "@api-types"
import { type ReactElement, useEffect, useState } from "react"
import { GameStatus } from "shared/domain/games/GameStatus.ts"
import { Alert, AlertDescription, AlertTitle } from "@/components/alert.tsx"
import { TurnButton } from "@/features/play/components/TurnButton.tsx"
import { TurnStatusBadge } from "@/features/play/components/TurnStatusBadge.tsx"
import { usePlayGameContext } from "@/features/play/PlayContext.tsx"
import { useUpdateReadiness } from "@/lib/api/useUpdateReadiness.ts"

export function GameTopBar(): ReactElement {
  const { gameDetails, turnState } = usePlayGameContext()

  return (
    <header className="shrink-0 border-b border-border/70 bg-background/80 px-4 sm:px-6">
      <div className="grid min-w-0 grid-cols-1 items-center gap-x-4 sm:h-[calc(6rem-1px)] sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <div className="min-w-0 space-y-1 py-3 sm:py-0">
          <div className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">Game #{gameDetails.id}</div>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h1 className="min-w-0 truncate font-heading text-xl font-semibold text-foreground sm:text-2xl">
              {gameDetails.configuration.name}
            </h1>
            {turnState === undefined ? null : <TurnStatusBadge status={turnState.turnStatus} />}
          </div>
        </div>
        <div className="min-w-0 justify-self-center self-stretch">
          {turnState === undefined ? null : <TurnControl turnState={turnState} />}
        </div>
      </div>
    </header>
  )
}

function TurnControl({ turnState }: { turnState: TurnState }): ReactElement {
  const { gameDetails, playerView, readinessTurn } = usePlayGameContext()
  const updateReadiness = useUpdateReadiness()
  const [currentTime, setCurrentTime] = useState(() => Date.now())
  const endsAt = new Date(turnState.turnEndsAt)
  const timeLeft = Math.max(0, endsAt.getTime() - currentTime)
  const deadline = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(endsAt)
  const isLockedIn = turnState.readinessByPlayerId[playerView.player.id]

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now())
    }, 1000)
    return (): void => {
      clearInterval(interval)
    }
  }, [])

  return (
    <div className="relative h-full">
      <TurnButton
        turn={turnState.turn}
        countdown={Temporal.Duration.from({ seconds: Math.floor(timeLeft / 1000) })}
        deadline={deadline}
        isLockedIn={isLockedIn}
        isPending={updateReadiness.isPending}
        disabled={updateReadiness.isPending || readinessTurn === undefined || timeLeft === 0 || gameDetails.status === GameStatus.ENDED}
        onToggle={() => {
          if (readinessTurn !== undefined && Date.now() < endsAt.getTime()) {
            updateReadiness.mutate({ gameId: gameDetails.id, turn: readinessTurn, isReady: !isLockedIn })
          }
        }}
      />
      {updateReadiness.error === null ? null : (
        <Alert variant="destructive" className="absolute top-full left-1/2 z-20 mt-2 w-72 -translate-x-1/2 bg-card">
          <AlertTitle>Could not change lock-in status</AlertTitle>
          <AlertDescription>{updateReadiness.error.message}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
