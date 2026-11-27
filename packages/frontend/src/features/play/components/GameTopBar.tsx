import { RefreshCw } from "lucide-react"
import { type ReactElement, useEffect, useState } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/alert.tsx"
import { Button } from "@/components/button.tsx"
import { TurnButton } from "@/features/play/components/TurnButton.tsx"
import { TurnStatusBadge } from "@/features/play/components/TurnStatusBadge.tsx"
import { usePlayGameContext } from "@/features/play/PlayContext.tsx"
import { useRefreshClientData } from "@/lib/api/useRefreshClientData.ts"
import { useUpdateReadiness } from "@/lib/api/useUpdateReadiness.ts"
import { useLogger } from "@/lib/LoggerContext.tsx"

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
            <TurnStatusBadge status={turnState.turnStatus} />
          </div>
        </div>
        <div className="min-w-0 justify-self-center self-stretch">
          <TurnControl />
        </div>
      </div>
    </header>
  )
}

function TurnControl(): ReactElement {
  const { gameDetails, playerView, turnState, canTakeAction, isCurrentPlayerReady } = usePlayGameContext()
  const logger = useLogger()
  const updateReadiness = useUpdateReadiness()
  const refreshClientData = useRefreshClientData()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [currentTime, setCurrentTime] = useState(() => new Date())
  const turnEndsAt = new Date(turnState.turnEndsAt)
  const timeLeft = calculateTimeLeft({ past: currentTime, future: turnEndsAt })
  const turnEndsAtLabel = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(turnEndsAt)

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return (): void => {
      clearInterval(interval)
    }
  }, [])

  async function refreshGameData(): Promise<void> {
    setIsRefreshing(true)

    try {
      await refreshClientData()
    } catch (error: unknown) {
      logger.error("Could not refresh game data", { error: error instanceof Error ? error.message : String(error) })
    } finally {
      setIsRefreshing(false)
    }
  }

  if (timeLeft.noTimeLeft) {
    return (
      <NextTurnRefreshButton
        detail={turnEndsAtLabel}
        isRefreshing={isRefreshing}
        onRefresh={() => {
          void refreshGameData()
        }}
      />
    )
  }

  return (
    <div className="relative h-full">
      <TurnButton
        turn={turnState.turn}
        countdown={timeLeft.duration}
        deadline={turnEndsAtLabel}
        isLockedIn={isCurrentPlayerReady}
        isPending={updateReadiness.isPending}
        disabled={updateReadiness.isPending || !canTakeAction}
        onToggle={() => {
          updateReadiness.mutate({ gameId: gameDetails.id, turn: playerView.turn, isReady: !isCurrentPlayerReady })
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

function NextTurnRefreshButton({
  detail,
  isRefreshing,
  onRefresh,
}: {
  detail: string
  isRefreshing: boolean
  onRefresh: () => void
}): ReactElement {
  return (
    <Button
      type="button"
      variant="outline"
      aria-label="Refresh game data for the next turn"
      className="h-full min-h-20 w-48 max-w-full flex-col gap-1 rounded-none border-0 border-b-2 border-primary/60 bg-transparent px-3 py-2 text-center shadow-none hover:border-primary hover:bg-primary/10"
      disabled={isRefreshing}
      onClick={onRefresh}
    >
      <RefreshCw className={`size-4 text-primary ${isRefreshing ? "animate-spin" : ""}`} />
      <div className="min-w-0">
        <div className="text-[0.7rem] font-medium tracking-[0.16em] text-muted-foreground uppercase">Next turn</div>
        <div className="truncate text-sm font-medium text-foreground">
          {isRefreshing ? "Refreshing..." : "Refresh"}
          <span className="block text-xs text-muted-foreground">{detail}</span>
        </div>
      </div>
    </Button>
  )
}

type TimeLeft = {
  noTimeLeft: boolean
  duration: Temporal.Duration
}

function calculateTimeLeft(config: { past: Date; future: Date }): TimeLeft {
  const past = Temporal.Instant.fromEpochMilliseconds(config.past.getTime())
  const future = Temporal.Instant.fromEpochMilliseconds(config.future.getTime())
  const duration = past.until(future).round({ largestUnit: "days" })

  return {
    noTimeLeft: duration.total("seconds") <= 0,
    duration,
  }
}
