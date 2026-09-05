import type { Lobby, PlayerId, PlayerView } from "@api-types"
import { branded } from "@guillaume-docquier/tools-ts"
import { Clock3, Crown, RefreshCw, TimerReset } from "lucide-react"
import { type ReactElement, useEffect, useState } from "react"
import { Button } from "@/components/button.tsx"
import { RESOURCE_ICONS, sortCostsByResource } from "@/features/play/components/resourceIcons.ts"
import { TurnStatusBadge } from "@/features/play/components/TurnStatusBadge.tsx"
import { formatRulesetTerm } from "@/features/play/mechanicToRulesText.ts"
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
            <TurnStatusBadge status={playerView.turnStatus} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <PlayerFact game={game} player={playerView.player} />
          <ResourcesFact resources={playerView.resources} />
          <TurnFact turn={playerView.turn} />
          <NextTurnFact targetTimestamp={playerView.turnEndsAt} />
        </div>
      </div>
      {game.winnerAccountId === null ? null : (
        <div className="mt-3 flex items-center gap-2 rounded-md border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
          <Crown className="size-4" />
          <span>{getWinnerLabel(branded(game.winnerAccountId), game)} has won the game.</span>
        </div>
      )}
    </header>
  )
}

function PlayerFact({ game, player }: { game: Lobby; player: PlayerView["player"] }): ReactElement {
  return (
    <TopBarFact
      icon={
        <span
          aria-hidden="true"
          className="size-4 rounded-full border border-foreground/30"
          style={{ backgroundColor: PLAYER_COLOR_HEX[player.color] }}
        />
      }
      label={formatPlayerColor(player.color)}
      value={getPlayerLabel(game, player.id)}
    />
  )
}

function TurnFact({ turn }: { turn: PlayerView["turn"] }): ReactElement {
  return <TopBarFact icon={<TimerReset className="size-4" />} label="Turn" value={turn.toString()} />
}

function ResourcesFact({ resources }: { resources: PlayerView["resources"] }): ReactElement {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Object.entries preserves the keys of the typed resource record at runtime.
  const resourceEntries = Object.entries(resources) as Array<[keyof typeof resources, (typeof resources)[keyof typeof resources]]>
  const sortedResources = sortCostsByResource(
    resourceEntries.map(([resourceType, { total, uncommitted }]) => ({
      resourceType,
      total,
      uncommitted,
    })),
  )

  return (
    <div className="group/resources relative">
      <div className="flex min-h-11 items-center rounded-md border border-border/70 bg-card/45 px-3 py-1.5">
        <div>
          <div className="text-[0.7rem] font-medium tracking-[0.16em] text-muted-foreground uppercase">Resources</div>
          <div className="flex gap-x-3">
            {sortedResources.map(({ resourceType, total, uncommitted }) => {
              const ResourceIcon = RESOURCE_ICONS[resourceType]
              const resourceName = formatRulesetTerm(resourceType)

              return (
                <div
                  key={resourceType}
                  className="flex items-center gap-1 text-sm font-medium"
                  aria-label={`${uncommitted} available of ${total} ${resourceName}`}
                >
                  <span>
                    {uncommitted} / {total}
                  </span>
                  <ResourceIcon className="size-4 text-amber-300" aria-hidden="true" />
                </div>
              )
            })}
          </div>
        </div>
      </div>
      <div className="invisible absolute top-full right-0 z-20 w-full pt-2 opacity-0 transition-opacity group-hover/resources:visible group-hover/resources:opacity-100">
        <div className="grid grid-cols-[max-content_1rem_max-content] justify-start gap-x-1 gap-y-1 rounded-md border border-border/70 bg-card px-3 py-2 shadow-lg">
          {sortedResources.map(({ resourceType, total, uncommitted }) => {
            const ResourceIcon = RESOURCE_ICONS[resourceType]

            return (
              <div key={resourceType} className="col-span-3 grid grid-cols-subgrid items-center text-sm font-medium">
                <span className="text-right">
                  {uncommitted} available of {total}
                </span>
                <ResourceIcon className="size-4 text-amber-300" aria-hidden="true" />
                <span className="text-left">{formatRulesetTerm(resourceType)}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function NextTurnFact({ targetTimestamp }: { targetTimestamp: string | Date }): ReactElement {
  const logger = useLogger()
  const refreshClientData = useRefreshClientData()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [currentTime, setCurrentTime] = useState(() => new Date())
  const turnEndsAt = new Date(targetTimestamp)
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
    <TopBarFact
      icon={<Clock3 className="size-4" />}
      label="Next turn"
      value={`${timeLeft.duration.days}d ${timeLeft.duration.hours}h ${timeLeft.duration.minutes}m ${timeLeft.duration.seconds}s`}
      detail={turnEndsAtLabel}
    />
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
      className="h-auto min-h-11 justify-start gap-2 rounded-md border-primary/50 bg-primary/10 px-3 py-1.5 text-left shadow-sm hover:border-primary/70 hover:bg-primary/20"
      disabled={isRefreshing}
      onClick={onRefresh}
    >
      <RefreshCw className={`size-4 text-primary ${isRefreshing ? "animate-spin" : ""}`} />
      <div className="min-w-0">
        <div className="text-[0.7rem] font-medium tracking-[0.16em] text-muted-foreground uppercase">Next turn</div>
        <div className="truncate text-sm font-medium text-foreground">
          {isRefreshing ? "Refreshing..." : "Refresh"}
          <span className="ml-2 text-muted-foreground">{detail}</span>
        </div>
      </div>
    </Button>
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

function getWinnerLabel(winnerPlayerId: PlayerId, game: Lobby): string {
  const winner = [game.creator, ...game.players].find((player) => player.id === winnerPlayerId)
  if (winner === undefined) {
    return `Player ${winnerPlayerId}`
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
