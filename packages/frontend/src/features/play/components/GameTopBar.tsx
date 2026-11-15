import type { GameDetails, PlayerId, PlayerView } from "@api-types"
import { branded } from "@guillaume-docquier/tools-ts"
import { Crown, RefreshCw } from "lucide-react"
import { type ReactElement, useEffect, useState } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/alert.tsx"
import { Button } from "@/components/button.tsx"
import { RESOURCE_ICONS, sortCostsByResource } from "@/features/play/components/resourceIcons.ts"
import { TurnButton } from "@/features/play/components/TurnButton.tsx"
import { TurnStatusBadge } from "@/features/play/components/TurnStatusBadge.tsx"
import { formatRulesetTerm } from "@/features/play/effectDefinitionToRulesText.ts"
import { useRefreshClientData } from "@/lib/api/useRefreshClientData.ts"
import { useUpdateReadiness } from "@/lib/api/useUpdateReadiness.ts"
import { useLogger } from "@/lib/LoggerContext.tsx"

export function GameTopBar({ gameDetails, playerView }: { gameDetails: GameDetails; playerView: PlayerView }): ReactElement {
  return (
    <header className="shrink-0 border-b border-border/70 bg-background/80 px-4 sm:px-6">
      <div className="grid min-w-0 grid-cols-1 items-center gap-x-4 sm:h-[calc(6rem-1px)] sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <div className="min-w-0 space-y-1 py-3 sm:py-0">
          <div className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">Game #{gameDetails.id}</div>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h1 className="min-w-0 truncate font-heading text-xl font-semibold text-foreground sm:text-2xl">
              {gameDetails.configuration.name}
            </h1>
            <TurnStatusBadge status={playerView.turnStatus} />
          </div>
        </div>
        <div className="min-w-0 justify-self-center self-stretch">
          <TurnControl gameDetails={gameDetails} playerView={playerView} />
        </div>
        <div className="min-w-0 justify-self-end py-3 sm:py-0">
          <ResourcesFact resources={playerView.resources} />
        </div>
      </div>
      {gameDetails.winnerAccountId === null ? null : (
        <div className="mb-3 flex items-center gap-2 rounded-md border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
          <Crown className="size-4" />
          <span>{getWinnerLabel(branded(gameDetails.winnerAccountId), gameDetails)} has won the game.</span>
        </div>
      )}
    </header>
  )
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
      <div className="flex flex-wrap justify-end gap-x-3 gap-y-2">
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

function TurnControl({ gameDetails, playerView }: { gameDetails: GameDetails; playerView: PlayerView }): ReactElement {
  const logger = useLogger()
  const updateReadiness = useUpdateReadiness()
  const refreshClientData = useRefreshClientData()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [currentTime, setCurrentTime] = useState(() => new Date())
  const turnEndsAt = new Date(playerView.turnEndsAt)
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
        turn={playerView.turn}
        countdown={formatCountdown(timeLeft.duration)}
        deadline={turnEndsAtLabel}
        isLockedIn={playerView.player.isReady}
        isPending={updateReadiness.isPending}
        disabled={updateReadiness.isPending || playerView.turnStatus !== "COLLECTING_ACTIONS" || gameDetails.winnerAccountId !== null}
        onToggle={() => {
          updateReadiness.mutate({ gameId: gameDetails.id, turn: playerView.turn, isReady: !playerView.player.isReady })
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

function getWinnerLabel(winnerPlayerId: PlayerId, gameDetails: GameDetails): string {
  const winner = [gameDetails.creator, ...gameDetails.players].find((player) => player.id === winnerPlayerId)
  if (winner === undefined) {
    return `Player ${winnerPlayerId}`
  }

  return winner.alias
}

function formatCountdown(duration: Temporal.Duration): string {
  const hours = duration.days * 24 + duration.hours
  return [hours, duration.minutes, duration.seconds].map((value) => value.toString().padStart(2, "0")).join(":")
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
