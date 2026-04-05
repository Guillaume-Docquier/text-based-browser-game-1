import { createFileRoute, Navigate, redirect } from "@tanstack/react-router"
import type { ReactElement } from "react"
import { Assert } from "@guillaume-docquier/tools-ts"
import { useBackendApiClient } from "../contexts/BackendApiClientContext.tsx"
import { useQuery } from "@tanstack/react-query"
import type * as ApiTypes from "@api-types"
import { timeAgo } from "../timeAgo.ts"
import { Skeleton } from "../design-system/Skeleton.tsx"
import { useLogger } from "../contexts/LoggerContext.tsx"

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

function Game({ game }: { game: ApiTypes.GameSummary }): ReactElement {
  return (
    <div className="flex flex-col gap-2 rounded border p-2">
      <div>Id: #{game.id}</div>
      <div>Name: {game.name}</div>
      <div>Creator:</div>
      <div className=" pl-2">
        <Player player={game.creator} />
      </div>
      <div>
        players ({game.players.length}/{game.maxPlayerCount})
      </div>
      <div className="flex flex-col gap-2 pl-2">
        {game.players.map((player) => (
          <Player player={player} key={player.id} />
        ))}
      </div>
      <div>Status: {game.endedAt !== null ? "Ended" : game.startedAt !== null ? "In Progress" : "Waiting for more players"}</div>
      <div>Created: {timeAgo(game.createdAt)}</div>
    </div>
  )
}

function Player({ player }: { player: ApiTypes.GameSummaryPlayer }): ReactElement {
  return (
    <div>
      <div>{player.alias ?? `Player ${player.id}`}</div>
    </div>
  )
}
