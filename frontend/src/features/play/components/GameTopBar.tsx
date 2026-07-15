import type { Lobby, PlayerId, PlayerView } from "@api-types"
import { Clock3, Crown, RefreshCw, TimerReset } from "lucide-react"
import { type ReactElement, useEffect, useState } from "react"
import { Button } from "@/components/button.tsx"
import { GameStatusBadge } from "@/features/play/components/GameStatusBadge.tsx"
import { useRefreshClientData } from "@/lib/api/useRefreshClientData.ts"
import { useLogger } from "@/lib/LoggerContext.tsx"
import { formatPlayerColor, PLAYER_COLOR_HEX } from "@/lib/playerColorHex.ts"

export function GameTopBar({ game, playerView }: { game: Lobby; playerView: PlayerView }): ReactElement {
  return (
    <header className="flex min-h-24 flex-col justify-center border-b border-border/70 bg-background/80 px-4 py-4 sm:px-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">Game #{game.id}</div>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h1 className="min-w-0 truncate font-heading text-xl font-semibold text-foreground sm:text-2xl">{game.configuration.name}</h1>
            <GameStatusBadge status={game.status} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <TopBarFact
            icon={
              <span
                aria-hidden="true"
                className="size-4 rounded-full border border-foreground/30"
                style={{ backgroundColor: PLAYER_COLOR_HEX[playerView.player.color] }}
              />
            }
            label={formatPlayerColor(playerView.player.color)}
            value={getPlayerLabel(game, playerView.player.id)}
          />
          <TopBarFact icon={<TimerReset className="size-4" />} label="Tick" value={playerView.tick.toString()} />
          <NextTickFact targetTimestamp={playerView.nextTickAt} />
        </div>
      </div>
      {game.winnerAccountId === null ? null : (
        <div className="mt-3 flex items-center gap-2 rounded-md border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
          <Crown className="size-4" />
          <span>{getWinnerLabel(game)} has won the game.</span>
        </div>
      )}
    </header>
  )
}

function NextTickFact({ targetTimestamp }: { targetTimestamp: string | Date }): ReactElement {
  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft({ past: new Date(), future: new Date(targetTimestamp) }))
  const [isRefreshing, setIsRefreshing] = useState(false)
  const refreshClientData = useRefreshClientData()
  const logger = useLogger()
  const nextTickAt = new Date(targetTimestamp)
  const nextTickAtLabel = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(nextTickAt)

  useEffect(() => {
    const future = new Date(targetTimestamp)
    function updateTimeLeft(): void {
      setTimeLeft(calculateTimeLeft({ past: new Date(), future }))
    }

    updateTimeLeft()
    const interval = setInterval(updateTimeLeft, 1000)

    return (): void => {
      clearInterval(interval)
    }
  }, [targetTimestamp])

  if (timeLeft.noTimeLeft) {
    async function refreshForNextTick(): Promise<void> {
      setIsRefreshing(true)
      try {
        await refreshClientData()
      } catch (error: unknown) {
        logger.error("Could not refresh game state for the next tick", {
          error: error instanceof Error ? error.message : String(error),
        })
      } finally {
        setIsRefreshing(false)
      }
    }

    return (
      <Button
        aria-label="Refresh game data to view the next tick"
        className="relative min-h-11 justify-start overflow-hidden rounded-md border-primary/60 bg-primary/10 px-3 text-left shadow-[0_0_18px_-8px_var(--color-primary)] hover:border-primary hover:bg-primary/20"
        disabled={isRefreshing}
        title={`Next tick was computed on ${nextTickAtLabel}`}
        variant="outline"
        onClick={() => {
          void refreshForNextTick()
        }}
      >
        <span aria-hidden="true" className="absolute inset-0 animate-pulse bg-linear-to-r from-transparent via-primary/20 to-transparent" />
        <RefreshCw className={`relative size-4 text-primary ${isRefreshing ? "animate-spin" : ""}`} />
        <span className="relative min-w-0">
          <span className="block text-[0.7rem] font-medium tracking-[0.16em] text-muted-foreground uppercase">Next tick ready</span>
          <span className="block truncate text-sm font-medium text-foreground">{isRefreshing ? "Refreshing..." : "Refresh"}</span>
        </span>
      </Button>
    )
  }

  return (
    <TopBarFact
      icon={<Clock3 className="size-4" />}
      label="Next tick"
      value={`${timeLeft.duration.days}d ${timeLeft.duration.hours}h ${timeLeft.duration.minutes}m ${timeLeft.duration.seconds}s`}
      detail={nextTickAtLabel}
    />
  )
}

function TopBarFact({ icon, label, value, detail }: { icon: ReactElement; label: string; value: string; detail?: string }): ReactElement {
  return (
    <div className="flex min-h-11 items-center gap-2 rounded-md border border-border/70 bg-card/45 px-3">
      <div className="text-primary">{icon}</div>
      <div className="min-w-0">
        <div className="text-[0.7rem] font-medium tracking-[0.16em] text-muted-foreground uppercase">{label}</div>
        <div className="truncate text-sm font-medium text-foreground">
          {value}
          {detail === undefined ? null : <span className="ml-2 text-muted-foreground">{detail}</span>}
        </div>
      </div>
    </div>
  )
}

function getWinnerLabel(game: Lobby): string {
  const winner = [game.creator, ...game.players].find((player) => player.id === game.winnerAccountId)

  if (winner === undefined) {
    return `Player ${game.winnerAccountId}`
  }

  return winner.alias ?? `Player ${winner.id}`
}

function getPlayerLabel(game: Lobby, playerId: PlayerId): string {
  const player = game.players.find(({ id }) => id === playerId)
  return player?.alias ?? `Player ${playerId}`
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
