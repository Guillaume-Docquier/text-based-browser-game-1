import type * as ApiTypes from "@api-types"
import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { Search } from "lucide-react"
import { type ReactElement, useState } from "react"
import { Alert, AlertDescription, AlertTitle } from "../../components/alert.tsx"
import { Button } from "../../components/button.tsx"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/card.tsx"
import { Input } from "../../components/input.tsx"
import { Skeleton } from "../../components/skeleton.tsx"
import { useBackendApiClient } from "../../lib/api/BackendApiClientContext.tsx"
import { timeAgo } from "../../lib/timeAgo.ts"
import { PageHeader } from "../PageHeader.tsx"
import { GameStatusBadge } from "../play/components/GameStatusBadge.tsx"

export function GamesBrowserPage(): ReactElement {
  const [gameNameFilter, setGameNameFilter] = useState("")
  const backendApiClient = useBackendApiClient()
  const gamesQuery = useQuery(backendApiClient.games.getGameLobbies.queryOptions())

  if (gamesQuery.isPending) {
    return <GamesLoadingState />
  }

  if (gamesQuery.isError) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <PageHeader
          title="Games"
          description="Browse active lobbies, filter by name, and jump back into an ongoing match."
          actions={
            <Button asChild>
              <Link to="/games/create">Create game</Link>
            </Button>
          }
        />
        <Alert variant="destructive">
          <AlertTitle>Could not load games</AlertTitle>
          <AlertDescription>{gamesQuery.error.message}</AlertDescription>
        </Alert>
      </div>
    )
  }

  const games = gamesQuery.data.filter((game) => game.configuration.name.includes(gameNameFilter))

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <PageHeader
        title="Games"
        description="Browse active lobbies, filter by name, and create a new game when you are ready to host."
        actions={
          <Button asChild>
            <Link to="/games/create">Create game</Link>
          </Button>
        }
      />
      <Card className="border border-border/60">
        <CardHeader className="gap-4">
          <CardTitle>Find a game</CardTitle>
          <CardDescription>Search by game name. Existing filter behavior is preserved.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={gameNameFilter}
              onChange={(event) => {
                setGameNameFilter(event.target.value)
              }}
              placeholder="Search for games"
              className="pl-9"
            />
          </div>
          <div className="grid gap-3">
            {games.length === 0 ? (
              <GamesEmptyState hasFilter={gameNameFilter !== ""} />
            ) : (
              games.map((game) => <GameSummary key={game.id} game={game} />)
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function GameSummary({ game }: { game: ApiTypes.GameLobby }): ReactElement {
  return (
    <Link to="/games/$gameId" params={{ gameId: game.id }} className="block">
      <Card size="sm" className="border border-border/60 transition-colors hover:bg-muted/40">
        <CardContent className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">#{game.id}</span>
              <GameStatusBadge status={game.status} />
            </div>
            <div className="font-heading text-lg font-medium text-foreground">{game.configuration.name}</div>
          </div>
          <div className="flex flex-col gap-1 text-sm text-muted-foreground md:items-end">
            <div>
              {game.players.length}/{game.configuration.nbSeats} players
            </div>
            <div>Created {timeAgo(game.createdAt)}</div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

function GamesLoadingState(): ReactElement {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <PageHeader
        title="Games"
        description="Browse active lobbies, filter by name, and create a new game when you are ready to host."
        actions={<Skeleton className="h-9 w-28 rounded-4xl" />}
      />
      <Card className="border border-border/60">
        <CardHeader className="gap-4">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Skeleton className="h-9 w-full max-w-md" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    </div>
  )
}

function GamesEmptyState({ hasFilter }: { hasFilter: boolean }): ReactElement {
  return (
    <Card size="sm" className="border border-dashed border-border/70 bg-muted/20">
      <CardContent className="space-y-2">
        <div className="font-medium text-foreground">{hasFilter ? "No matching games" : "No games yet"}</div>
        <p className="text-sm text-muted-foreground">
          {hasFilter ? "Try a different search term or create a new game." : "Create the first lobby to start playing."}
        </p>
      </CardContent>
    </Card>
  )
}
