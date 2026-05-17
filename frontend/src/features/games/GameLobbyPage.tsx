import { useMutation, useQuery, type UseMutationOptions } from "@tanstack/react-query"
import { Navigate, useNavigate } from "@tanstack/react-router"
import type { ReactElement } from "react"
import type * as ApiTypes from "@api-types"
import { PageHeader } from "../PageHeader.tsx"
import { GameStatusBadge } from "../play/components/GameStatusBadge.tsx"
import { Button } from "../../components/button.tsx"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/card.tsx"
import { Separator } from "../../components/separator.tsx"
import { Skeleton } from "../../components/skeleton.tsx"
import { useBackendApiClient } from "../../lib/api/BackendApiClientContext.tsx"
import { useLogger } from "../../lib/LoggerContext.tsx"
import { formatGameSummaryStatus } from "../../lib/formatGameSummaryStatus.ts"
import { timeAgo } from "../../lib/timeAgo.ts"

export function GameLobbyPage({ gameId }: { gameId: number }): ReactElement {
  const logger = useLogger()
  const backendApiClient = useBackendApiClient()
  const gameQuery = useQuery(backendApiClient.games.getSummaryById.queryOptions({ gameId }))

  if (gameQuery.isPending) return <GameLobbyLoadingState />
  if (gameQuery.isError) {
    logger.error("Could not fetch game", { gameId, error: gameQuery.error.message })
    return <Navigate to="/games" />
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <Game game={gameQuery.data.game} />
    </div>
  )
}

function Game({ game }: { game: ApiTypes.GameSummary }): ReactElement {
  const navigate = useNavigate()
  const backendApiClient = useBackendApiClient()
  const joinGame = useMutation(backendApiClient.games.join.mutationOptions() as UseMutationOptions<unknown, Error, { gameId: number }>)
  const leaveGame = useMutation(backendApiClient.games.leave.mutationOptions() as UseMutationOptions<unknown, Error, { gameId: number }>)
  const startGame = useMutation(backendApiClient.games.start.mutationOptions() as UseMutationOptions<unknown, Error, { gameId: number }>)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={game.name}
        description={`Game #${game.id} created ${timeAgo(game.createdAt)}.`}
        actions={<GameStatusBadge status={game.status} />}
      />
      <Card className="border border-border/60">
        <CardHeader>
          <CardTitle>Lobby details</CardTitle>
          <CardDescription>Review the roster, join or leave the lobby, and start once the game is ready.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="grid gap-4 md:grid-cols-2">
            <DetailBlock label="Status" value={formatGameSummaryStatus(game.status)} />
            <DetailBlock label="Seats" value={`${game.players.length}/${game.nbSeats} players`} />
            <div className="space-y-1">
              <div className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">Creator</div>
              <Player player={game.creator} />
            </div>
            <DetailBlock label="Created" value={timeAgo(game.createdAt)} />
            {game.winnerPlayerId !== null ? <DetailBlock label="Winner" value={getWinnerLabel(game)} /> : null}
          </div>
          <Separator />
          <div className="space-y-3">
            <div className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
              Players ({game.players.length}/{game.nbSeats})
            </div>
            <div className="grid gap-2">
              {game.players.map((player) => (
                <Player player={player} key={player.id} />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="flex flex-wrap gap-3">
        {game.canJoin && (
          <Button
            disabled={joinGame.isPending}
            onClick={() => {
              joinGame.mutate({ gameId: game.id })
            }}
          >
            Join game
          </Button>
        )}
        {game.canLeave && (
          <Button
            variant="outline"
            disabled={leaveGame.isPending}
            onClick={() => {
              leaveGame.mutate({ gameId: game.id })
            }}
          >
            Leave game
          </Button>
        )}
        {game.canStart && (
          <Button
            disabled={startGame.isPending}
            onClick={() => {
              startGame.mutate({ gameId: game.id })
            }}
          >
            Start game
          </Button>
        )}
        {game.status === "STARTED" && (
          <Button
            variant="secondary"
            disabled={startGame.isPending}
            onClick={() => {
              void navigate({ to: "/play/$gameId", params: { gameId: game.id } })
            }}
          >
            Open game
          </Button>
        )}
      </div>
    </div>
  )
}

function DetailBlock({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">{label}</div>
      <div className="text-sm text-foreground">{value}</div>
    </div>
  )
}
function Player({ player }: { player: ApiTypes.GameSummaryPlayer }): ReactElement {
  return (
    <div className="rounded-3xl border border-border/60 bg-muted/20 px-4 py-3">
      <div className="font-medium text-foreground">{player.alias ?? `Player ${player.id}`}</div>
    </div>
  )
}
function GameLobbyLoadingState(): ReactElement {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <PageHeader
        title="Loading game"
        description="Fetching lobby details and available actions."
        actions={<Skeleton className="h-6 w-28 rounded-full" />}
      />
      <Card className="border border-border/60">
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-px w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </CardContent>
      </Card>
      <div className="flex gap-3">
        <Skeleton className="h-9 w-24 rounded-4xl" />
        <Skeleton className="h-9 w-24 rounded-4xl" />
      </div>
    </div>
  )
}
function getWinnerLabel(game: ApiTypes.GameSummary): string {
  const winner = [game.creator, ...game.players].find((player) => player.id === game.winnerPlayerId)
  if (winner === undefined) {
    return `Player ${game.winnerPlayerId}`
  }
  return winner.alias ?? `Player ${winner.id}`
}
