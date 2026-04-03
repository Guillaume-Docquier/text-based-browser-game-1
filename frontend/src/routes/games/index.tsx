import { type ReactElement, useState } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { Search } from "lucide-react"
import { TextInput } from "../../design-system/TextInput.tsx"
import { useQuery } from "@tanstack/react-query"
import { useBackendApiClient } from "../../contexts/BackendApiClientContext.tsx"
import type * as ApiTypes from "@api-types"

export const Route = createFileRoute("/games/")({
  component: Games,
})

function Games(): ReactElement {
  const [gameNameFilter, setGameNameFilter] = useState("")
  const backendApiClient = useBackendApiClient()

  const gamesQuery = useQuery(backendApiClient.games.getAll.queryOptions())

  const games = gamesQuery.data?.games.filter((game) => game.name.includes(gameNameFilter))

  return (
    <div className="flex flex-col items-center text-white h-[calc(100vh-theme(space.16))] py-30">
      <div className="p-8 w-200 bg-surface-100 flex flex-col gap-y-3 rounded-xl">
        <div className="flex flex-row gap-2 items-center">
          <Search />
          <TextInput value={gameNameFilter} onChange={setGameNameFilter} placeholder="search for games" />
        </div>
        <div className="flex flex-col gap-2">
          {games === undefined || games.length === 0 ? "No games found" : games.map((game) => <Game key={game.id} game={game} />)}
        </div>
      </div>
    </div>
  )
}

function Game({ game }: { game: ApiTypes.Game }): ReactElement {
  return (
    <Link
      to="/games/$gameId"
      params={{ gameId: game.id }}
      className="flex gap-2 rounded border border-surface-500 p-2 hover:bg-surface-200 cursor-pointer"
    >
      <div>#{game.id}</div>
      <div>{game.name}</div>
      <div>0/{game.maxPlayerCount} players</div>
      <div>{game.endedAt !== null ? "Ended" : game.startedAt !== null ? "In Progress" : "Waiting for more players"}</div>
      <div>created {timeAgo(game.createdAt as unknown as string)}</div>
    </Link>
  )
}

function timeAgo(timestamp: string): string {
  const now = Date.now()
  const diffMs = now - new Date(timestamp).getTime()

  const seconds = Math.floor(diffMs / 1000)
  if (seconds < 60) {
    return `${seconds} seconds ago`
  }

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) {
    return `${minutes} minutes ago`
  }

  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    return `${hours} hours ago`
  }

  const days = Math.floor(hours / 24)
  return `${days} days ago`
}
