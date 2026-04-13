import { createFileRoute, Navigate, redirect } from "@tanstack/react-router"
import { type ReactElement, useEffect, useState } from "react"
import { z } from "zod"
import { useBackendApiClient } from "../contexts/BackendApiClientContext.tsx"
import { useQuery } from "@tanstack/react-query"
import { Skeleton } from "../design-system/Skeleton.tsx"
import { useLogger } from "../contexts/LoggerContext.tsx"

const paramsSchema = z.object({
  gameId: z.coerce.number(),
})

export const Route = createFileRoute("/play/$gameId")({
  component: GameClient,
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
  const gameStateQuery = useQuery(backendApiClient.gameStates.getById.queryOptions({ gameId }))

  if (gameStateQuery.isPending) {
    return <Skeleton />
  }

  if (gameStateQuery.isError) {
    logger.error("Could not fetch game", { gameId, error: gameStateQuery.error.message })
    return <Navigate to="/games" />
  }

  const gameState = gameStateQuery.data.gameState

  return (
    <div className="flex flex-col items-center justify-center">
      <div>Current tick: {gameState.tick}</div>
      <Countdown targetTimestamp={gameState.nextTickAt} />
    </div>
  )
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
    } // cleanup
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

  const duration = future.since(past).round({ largestUnit: "days" })

  return {
    noTimeLeft: duration.total("seconds") <= 0,
    duration,
  }
}
