import { Clock3, Crown, TimerReset } from "lucide-react"
import { type ReactElement, useEffect, useState } from "react"
import type * as ApiTypes from "@api-types"
import type { PlayGameState } from "../PlayContext.tsx"
import { GameStatusBadge } from "./GameStatusBadge.tsx"

export function GameTopBar({ game, gameState }: { game: ApiTypes.GameSummary; gameState: PlayGameState }): ReactElement {
  return (
    <header className="flex min-h-24 flex-col justify-center border-b border-border/70 bg-background/80 px-4 py-4 sm:px-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">Game #{game.id}</div>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h1 className="min-w-0 truncate font-heading text-xl font-semibold text-foreground sm:text-2xl">{game.name}</h1>
            <GameStatusBadge status={game.status} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <TopBarFact icon={<TimerReset className="size-4" />} label="Tick" value={gameState.tick.toString()} />
          <NextTickFact targetTimestamp={gameState.nextTickAt} />
        </div>
      </div>
      {game.winnerPlayerId === null ? null : (
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
  const nextTickAt = new Date(targetTimestamp)
  const nextTickAtLabel = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(nextTickAt)

  useEffect(() => {
    const future = new Date(targetTimestamp)
    const interval = setInterval(() => {
      setTimeLeft(calculateTimeLeft({ past: new Date(), future }))
    }, 1000)

    return (): void => {
      clearInterval(interval)
    }
  }, [targetTimestamp])

  if (timeLeft.noTimeLeft) {
    return <TopBarFact icon={<Clock3 className="size-4" />} label="Next tick" value="ready" detail={nextTickAtLabel} />
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

function getWinnerLabel(game: ApiTypes.GameSummary): string {
  const winner = [game.creator, ...game.players].find((player) => player.id === game.winnerPlayerId)

  if (winner === undefined) {
    return `Player ${game.winnerPlayerId}`
  }

  return winner.alias ?? `Player ${winner.id}`
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
