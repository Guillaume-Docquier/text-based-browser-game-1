import { createFileRoute, Navigate, redirect } from "@tanstack/react-router"
import { type ReactElement, useEffect, useState } from "react"
import { z } from "zod"
import { useBackendApiClient } from "../contexts/BackendApiClientContext.tsx"
import { useMutation, useQuery } from "@tanstack/react-query"
import { Skeleton } from "../design-system/Skeleton.tsx"
import { useLogger } from "../contexts/LoggerContext.tsx"
import { privateRoute } from "../privateRoute.ts"
import type * as ApiTypes from "@api-types"

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
    return <Skeleton />
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
  const gameState = gameStateQuery.data.gameState
  const currentAction = currentActionQuery.data.action

  return (
    <div className="flex flex-col items-center justify-center p-8">
      <div className="flex w-full max-w-3xl flex-col gap-6">
        <div className="rounded-2xl border border-surface-200 bg-surface-100 p-6">
          <div className="text-sm uppercase tracking-wide text-surface-500">Game #{gameId}</div>
          {game.winnerPlayerId !== null && (
            <div className="mt-2 text-lg font-semibold text-success-100">Winner: {getWinnerLabel(game)}</div>
          )}
          <div className="mt-2 text-2xl font-semibold">Current tick: {gameState.tick}</div>
          <div className="mt-2 text-lg">Money: {gameState.resources.money}</div>
          <div className="mt-4">
            <Countdown targetTimestamp={gameState.nextTickAt} />
          </div>
        </div>

        <div className="rounded-2xl border border-surface-200 bg-surface-100 p-6">
          <div className="text-xl font-semibold">Choose your action</div>
          <div className="mt-1 text-surface-500">Your selection applies to tick {gameState.tick} only.</div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {PLAYER_ACTIONS.map((action) => {
              const isSelected = currentAction?.actionType === action.actionType
              const disabledReason = currentActionQuery.isError
                ? "Actions are currently unavailable."
                : gameState.resources.money < action.costMoney
                  ? `Requires ${action.costMoney} money.`
                  : undefined

              return (
                <button
                  className={`flex cursor-pointer flex-col gap-3 rounded-2xl border p-4 text-left transition ${
                    isSelected ? "border-primary-50 bg-surface-tonal-50" : "border-surface-200 bg-surface-50 hover:border-primary-200"
                  } disabled:cursor-not-allowed disabled:border-surface-200 disabled:bg-surface-100 disabled:text-surface-500`}
                  disabled={disabledReason !== undefined || setCurrentAction.isPending}
                  key={action.actionType}
                  onClick={() => {
                    setCurrentAction.mutate({
                      gameId,
                      tick: gameState.tick,
                      actionType: isSelected ? null : action.actionType,
                    })
                  }}
                  type="button"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-lg font-semibold">{action.label}</div>
                    {isSelected && <div className="text-sm font-semibold uppercase text-primary-200">Selected</div>}
                  </div>
                  <div className="text-sm text-surface-500">{action.description}</div>
                  <div className="text-sm">
                    Cost: {action.costMoney} money
                    {action.rewardMoney > 0
                      ? ` | Effect: +${action.rewardMoney} money after paying the cost`
                      : " | Effect: End the game immediately"}
                  </div>
                  {disabledReason !== undefined && <div className="text-sm text-danger-100">{disabledReason}</div>}
                </button>
              )
            })}
          </div>

          <div className="mt-4 text-sm text-surface-500">
            Current selection: {currentAction === null ? "No action selected yet." : getActionLabel(currentAction.actionType)}
          </div>
          {setCurrentAction.isError && <div className="mt-2 text-sm text-danger-100">{setCurrentAction.error.message}</div>}
        </div>
      </div>
    </div>
  )
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

function Countdown({ targetTimestamp }: { targetTimestamp: string }): ReactElement {
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
    return <div>Tick is over, refresh the page!</div>
  }

  return (
    <div>
      <div>Next tick in</div>
      <p>
        {timeLeft.duration.days}d {timeLeft.duration.hours}h {timeLeft.duration.minutes}m {timeLeft.duration.seconds}s
      </p>
    </div>
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
