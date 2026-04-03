import { createFileRoute, Navigate, redirect } from "@tanstack/react-router"
import type { ReactElement } from "react"
import { Assert } from "@guillaume-docquier/tools-ts"
import { useBackendApiClient } from "../../contexts/BackendApiClientContext.tsx"
import { useQuery } from "@tanstack/react-query"
import type * as ApiTypes from "@api-types"
import { timeAgo } from "../../timeAgo.ts"
import { Skeleton } from "../../design-system/Skeleton.tsx"
import { useLogger } from "../../contexts/LoggerContext.tsx"

export const Route = createFileRoute("/games/$gameId")({
  component: GameLobby,
  params: {
    parse: (rawParams) => {
      const gameId = Number(rawParams.gameId)
      Assert.isTrue(!isNaN(gameId))

      return { gameId }
    },
  },
  onError: (error) => {
    if (error?.routerCode === "PARSE_PARAMS") {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- This how tanstack works
      throw redirect({ to: "/games" })
    }
  },
})

function GameLobby(): ReactElement {
  const logger = useLogger()
  const { gameId } = Route.useParams()
  const backendApiClient = useBackendApiClient()
  const gameQuery = useQuery(backendApiClient.games.getById.queryOptions({ gameId }))

  if (gameQuery.isPending) {
    return <Skeleton />
  }

  if (gameQuery.isError) {
    logger.error("Could not fetch game", { gameId, error: gameQuery.error.message })
    return <Navigate to="/games" />
  }

  return (
    <div className="p-8">
      <Game game={gameQuery.data.game} />
    </div>
  )
}

function Game({ game }: { game: ApiTypes.Game }): ReactElement {
  return (
    <div className="flex gap-2 rounded border p-2">
      <div>#{game.id}</div>
      <div>{game.name}</div>
      <div>0/{game.maxPlayerCount} players</div>
      <div>{game.endedAt !== null ? "Ended" : game.startedAt !== null ? "In Progress" : "Waiting for more players"}</div>
      <div>created {timeAgo(game.createdAt as unknown as string)}</div>
    </div>
  )
}
