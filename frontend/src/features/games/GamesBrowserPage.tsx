import type * as ApiTypes from "@api-types"
import { useAuth } from "@clerk/react"
import { Link } from "@tanstack/react-router"
import { Search, UserRoundCheck } from "lucide-react"
import { type ReactElement, useState } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/alert.tsx"
import { Button } from "@/components/button.tsx"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/card.tsx"
import { Input } from "@/components/input.tsx"
import { Skeleton } from "@/components/skeleton.tsx"
import { PageHeader } from "@/features/PageHeader.tsx"
import { GameStatusBadge } from "@/features/play/components/GameStatusBadge.tsx"
import { useListingsQuery } from "@/lib/api/useListingsQuery.ts"
import { timeAgo } from "@/lib/timeAgo.ts"

export function GamesBrowserPage(): ReactElement {
  const [gameNameFilter, setGameNameFilter] = useState("")
  const [showOnlyMyGames, setShowOnlyMyGames] = useState(false)
  const { isSignedIn } = useAuth()
  const listingsQuery = useListingsQuery()

  if (listingsQuery.isPending) {
    return <GamesLoadingState />
  }

  if (listingsQuery.isError) {
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
          <AlertDescription>{listingsQuery.error.message}</AlertDescription>
        </Alert>
      </div>
    )
  }

  const onlyMyGamesFilter = showOnlyMyGames && isSignedIn === true
  const listings = listingsQuery.data.filter(
    (listing) => listing.name.includes(gameNameFilter) && (!onlyMyGamesFilter || listing.hasJoined),
  )
  const hasFilter = gameNameFilter !== "" || onlyMyGamesFilter

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
          <CardDescription>Search by game name or show only games you have joined.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex max-w-xl flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
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
            {isSignedIn === true ? (
              <Button
                type="button"
                variant={showOnlyMyGames ? "secondary" : "outline"}
                aria-pressed={showOnlyMyGames}
                onClick={() => {
                  setShowOnlyMyGames((isShown) => !isShown)
                }}
              >
                <UserRoundCheck />
                My games
              </Button>
            ) : null}
          </div>
          <div className="grid gap-3">
            {listings.length === 0 ? (
              <GamesEmptyState hasFilter={hasFilter} />
            ) : (
              listings.map((listing) => <GameSummary key={listing.id} listing={listing} />)
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function GameSummary({ listing }: { listing: ApiTypes.Listing }): ReactElement {
  return (
    <Link to="/games/$gameId" params={{ gameId: listing.id }} className="block">
      <Card size="sm" className="border border-border/60 transition-colors hover:bg-muted/40">
        <CardContent className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">#{listing.id}</span>
              <GameStatusBadge status={listing.status} />
            </div>
            <div className="font-heading text-lg font-medium text-foreground">{listing.name}</div>
          </div>
          <div className="flex flex-col gap-1 text-sm text-muted-foreground md:items-end">
            <div>
              {listing.nbPlayers}/{listing.nbSeats} players
            </div>
            <div>Created {timeAgo(listing.createdAt)}</div>
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
          {hasFilter ? "Try adjusting your filters or create a new game." : "Create the first lobby to start playing."}
        </p>
      </CardContent>
    </Card>
  )
}
