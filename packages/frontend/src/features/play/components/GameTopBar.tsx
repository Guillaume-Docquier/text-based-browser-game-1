import type { ReactElement } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/alert.tsx"
import { TurnButton } from "@/features/play/components/TurnButton.tsx"
import { TurnStatusBadge } from "@/features/play/components/TurnStatusBadge.tsx"
import type { PlayGameContextValue } from "@/features/play/PlayContext.tsx"
import { useUpdateReadiness } from "@/lib/api/useUpdateReadiness.ts"

export function GameTopBar({ game, currentTime }: { game: PlayGameContextValue; currentTime: number }): ReactElement {
  const { gameDetails, turnState } = game
  return (
    <header className="shrink-0 border-b border-border/70 bg-background/80 px-4 sm:px-6">
      <div className="grid min-w-0 grid-cols-1 items-center gap-x-4 sm:h-[calc(6rem-1px)] sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <div className="min-w-0 space-y-1 py-3 sm:py-0">
          <div className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">Game #{gameDetails.id}</div>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h1 className="min-w-0 truncate font-heading text-xl font-semibold text-foreground sm:text-2xl">
              {gameDetails.configuration.name}
            </h1>
            <TurnStatusBadge status={turnState.turnStatus} />
          </div>
        </div>
        <div className="min-w-0 justify-self-center self-stretch">
          <TurnControl game={game} currentTime={currentTime} />
        </div>
      </div>
    </header>
  )
}

function TurnControl({ game, currentTime }: { game: PlayGameContextValue; currentTime: number }): ReactElement {
  const { gameDetails, playerView, turnState, canUpdateReadiness } = game
  const updateReadiness = useUpdateReadiness()
  const turnEndsAt = new Date(turnState.turnEndsAt)
  const countdown = Temporal.Duration.from({ seconds: Math.max(0, Math.floor((turnEndsAt.getTime() - currentTime) / 1_000)) })
  const deadline = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(turnEndsAt)
  const isLockedIn = turnState.readinessByPlayerId[playerView.player.id] ?? false

  return (
    <div className="relative h-full">
      <TurnButton
        turn={turnState.turn}
        countdown={countdown}
        deadline={deadline}
        isLockedIn={isLockedIn}
        isPending={updateReadiness.isPending}
        disabled={!canUpdateReadiness || updateReadiness.isPending}
        onToggle={() => {
          updateReadiness.mutate({ gameId: gameDetails.id, turn: turnState.turn, isReady: !isLockedIn })
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
