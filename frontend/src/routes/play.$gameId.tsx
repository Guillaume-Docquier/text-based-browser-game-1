import { useMutation, useQuery } from "@tanstack/react-query"
import { createFileRoute, Navigate, redirect } from "@tanstack/react-router"
import { AlertTriangle, CheckCircle2, Clock3, Coins, Crown, TimerReset } from "lucide-react"
import { type ReactElement, useEffect, useState } from "react"
import { z } from "zod"
import type * as ApiTypes from "@api-types"
import { GameStatusBadge } from "../components/GameStatusBadge.tsx"
import { PageHeader } from "../components/PageHeader.tsx"
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert.tsx"
import { Button } from "../components/ui/button.tsx"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card.tsx"
import { Skeleton } from "../components/ui/skeleton.tsx"
import { useBackendApiClient } from "../contexts/BackendApiClientContext.tsx"
import { useLogger } from "../contexts/LoggerContext.tsx"
import { privateRoute } from "../privateRoute.ts"

type PlayGameState = {
  tick: number
  nextTickAt: string | Date
  resources: {
    money: number
  }
}

const PLAYER_ACTIONS = [
  {
    actionType: "MAKE_MORE_MONEY",
    label: "Make More Money",
    description: "Turn 2 money into 5 extra money after the normal tick income.",
    costMoney: 2,
    rewardMoney: 5,
  },
  {
    actionType: "WIN_THE_GAME",
    label: "Win The Game",
    description: "Spend 10 money and immediately end the game in your favor.",
    costMoney: 10,
    rewardMoney: 0,
  },
] as const satisfies Array<{
  actionType: ApiTypes.GamePlayerAction["actionType"]
  label: string
  description: string
  costMoney: number
  rewardMoney: number
}>

const paramsSchema = z.object({
  gameId: z.coerce.number(),
})

export const Route = createFileRoute("/play/$gameId")({
  component: GameClient,
  beforeLoad: privateRoute,
  params: {
    parse: (params) => paramsSchema.parse(params),
  },
  onError: (error) => {
    if (error?.routerCode === "PARSE_PARAMS") {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- This how tanstack works
      throw redirect({ to: "/" })
    }
  },
})

function GameClient(): ReactElement {
  const logger = useLogger()
  const { gameId } = Route.useParams()
  const backendApiClient = useBackendApiClient()
  const gameQuery = useQuery(backendApiClient.games.getSummaryById.queryOptions({ gameId }))
  const gameStateQuery = useQuery(backendApiClient.gameStates.getById.queryOptions({ gameId }))
  const currentActionQuery = useQuery(backendApiClient.gamePlayerActions.getCurrentAction.queryOptions({ gameId }))
  const setCurrentAction = useMutation(backendApiClient.gamePlayerActions.setCurrentAction.mutationOptions())

  if (gameQuery.isPending || gameStateQuery.isPending || currentActionQuery.isPending) {
    return <GameClientSkeleton />
  }

  if (gameQuery.isError) {
    logger.error("Could not fetch game", { gameId, error: gameQuery.error.message })
    return <Navigate to="/games" />
  }

  if (gameStateQuery.isError) {
    logger.error("Could not fetch game state", { gameId, error: gameStateQuery.error.message })
    return <Navigate to="/games" />
  }

  if (currentActionQuery.isError) {
    logger.error("Could not fetch current action", { gameId, error: currentActionQuery.error.message })
    return <Navigate to="/games" />
  }

  const game = gameQuery.data.game
  const gameState = (gameStateQuery.data as { gameState: PlayGameState }).gameState
  const currentAction = currentActionQuery.data.action

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <PageHeader
        title={game.name}
        description={`Game #${gameId}. Track the current tick, watch the countdown, and lock in your action for tick ${gameState.tick}.`}
        actions={<GameStatusBadge status={game.status} />}
      />

      {game.winnerPlayerId !== null ? (
        <Alert className="border-emerald-400/30 bg-emerald-500/10 text-emerald-50">
          <Crown className="size-4" />
          <AlertTitle>Winner decided</AlertTitle>
          <AlertDescription>{getWinnerLabel(game)} has already won this game.</AlertDescription>
        </Alert>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard
          title="Current tick"
          description="The active game loop step."
          value={gameState.tick.toString()}
          icon={<TimerReset className="size-5 text-primary" />}
        />
        <MetricCard
          title="Money"
          description="Your currently available resource balance."
          value={gameState.resources.money.toString()}
          icon={<Coins className="size-5 text-primary" />}
        />
        <CountdownCard targetTimestamp={gameState.nextTickAt} />
      </section>

      <Card className="border border-border/70 bg-card/95">
        <CardHeader>
          <CardTitle>Choose your action</CardTitle>
          <CardDescription>Your selection applies to tick {gameState.tick} only. Click again to clear the current choice.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            {PLAYER_ACTIONS.map((action) => {
              const isSelected = currentAction?.actionType === action.actionType
              const disabledReason =
                gameState.resources.money < action.costMoney ? `Requires ${action.costMoney} money.` : undefined

              return (
                <Card
                  key={action.actionType}
                  className={`border transition-colors ${
                    isSelected ? "border-primary/50 bg-primary/5" : "border-border/60"
                  } ${disabledReason === undefined ? "hover:bg-muted/30" : "opacity-80"}`}
                >
                  <CardHeader className="gap-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <CardTitle className="text-lg">{action.label}</CardTitle>
                        <CardDescription>{action.description}</CardDescription>
                      </div>
                      {isSelected ? <CheckCircle2 className="size-5 text-primary" /> : null}
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    <div className="text-sm text-muted-foreground">
                      Cost: {action.costMoney} money
                      {action.rewardMoney > 0
                        ? ` | Effect: +${action.rewardMoney} money after paying the cost`
                        : " | Effect: End the game immediately"}
                    </div>
                    {disabledReason !== undefined ? (
                      <Alert variant="destructive">
                        <AlertTriangle className="size-4" />
                        <AlertTitle>Unavailable</AlertTitle>
                        <AlertDescription>{disabledReason}</AlertDescription>
                      </Alert>
                    ) : null}
                    <div>
                      <Button
                        variant={isSelected ? "secondary" : "default"}
                        disabled={disabledReason !== undefined || setCurrentAction.isPending}
                        onClick={() => {
                          setCurrentAction.mutate({
                            gameId,
                            tick: gameState.tick,
                            actionType: isSelected ? null : action.actionType,
                          })
                        }}
                        type="button"
                      >
                        {isSelected ? "Clear selection" : "Select action"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          <Alert>
            <CheckCircle2 className="size-4" />
            <AlertTitle>Current selection</AlertTitle>
            <AlertDescription>
              {currentAction === null ? "No action selected yet." : getActionLabel(currentAction.actionType)}
            </AlertDescription>
          </Alert>

          {setCurrentAction.isError ? (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertTitle>Could not update action</AlertTitle>
              <AlertDescription>{setCurrentAction.error.message}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border border-border/70 bg-card/95">
        <CardHeader>
          <CardTitle>Tick timing</CardTitle>
          <CardDescription>
            The next server tick is scheduled from the backend state. Refresh after it completes to view the updated state.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Next tick scheduled for <span className="font-medium text-foreground">{new Date(gameState.nextTickAt).toLocaleString()}</span>.
        </CardContent>
      </Card>
    </div>
  )
}

function CountdownCard({ targetTimestamp }: { targetTimestamp: string | Date }): ReactElement {
  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft({ past: new Date(), future: new Date(targetTimestamp) }))

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
    return (
      <Card className="border border-amber-400/30 bg-amber-500/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock3 className="size-5 text-amber-200" />
            Countdown
          </CardTitle>
          <CardDescription className="text-amber-100/80">The active tick window has ended.</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="border-amber-400/30 bg-transparent text-amber-50">
            <AlertTriangle className="size-4" />
            <AlertTitle>Tick is over, refresh the page!</AlertTitle>
            <AlertDescription>The countdown reached zero and waits for the next game state fetch.</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <MetricCard
      title="Countdown"
      description="Time remaining before the next tick."
      value={`${timeLeft.duration.days}d ${timeLeft.duration.hours}h ${timeLeft.duration.minutes}m ${timeLeft.duration.seconds}s`}
      icon={<Clock3 className="size-5 text-primary" />}
    />
  )
}

function MetricCard({
  title,
  description,
  value,
  icon,
}: {
  title: string
  description: string
  value: string
  icon: ReactElement
}): ReactElement {
  return (
    <Card className="border border-border/70 bg-card/95">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <div className="rounded-full border border-border/70 bg-muted/70 p-2">{icon}</div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="font-heading text-3xl font-semibold tracking-tight text-foreground">{value}</p>
      </CardContent>
    </Card>
  )
}

function GameClientSkeleton(): ReactElement {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <div className="space-y-3">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-5 w-full max-w-2xl" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-44 rounded-4xl" />
        <Skeleton className="h-44 rounded-4xl" />
        <Skeleton className="h-44 rounded-4xl" />
      </div>
      <Skeleton className="h-72 rounded-4xl" />
      <Skeleton className="h-32 rounded-4xl" />
    </div>
  )
}

function getActionLabel(actionType: ApiTypes.GamePlayerAction["actionType"]): string {
  const action = PLAYER_ACTIONS.find((playerAction) => playerAction.actionType === actionType)

  return action?.label ?? actionType
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
