import type * as ApiTypes from "@api-types"
import { Navigate, useNavigate } from "@tanstack/react-router"
import type { ReactElement } from "react"
import { Button } from "@/components/button.tsx"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/card.tsx"
import { Separator } from "@/components/separator.tsx"
import { Skeleton } from "@/components/skeleton.tsx"
import { PageHeader } from "@/features/PageHeader.tsx"
import { GameStatusBadge } from "@/features/play/components/GameStatusBadge.tsx"
import { useJoinGameMutation } from "@/lib/api/useJoinGameMutation.ts"
import { useLeaveGameMutation } from "@/lib/api/useLeaveGameMutation.ts"
import { useLobbyQuery } from "@/lib/api/useLobbyQuery.ts"
import { useStartGameMutation } from "@/lib/api/useStartGameMutation.ts"
import { useLogger } from "@/lib/LoggerContext.tsx"
import { formatPlayerColor, PLAYER_COLOR_HEX } from "@/lib/playerColorHex.ts"
import { timeAgo } from "@/lib/timeAgo.ts"

export function LobbyPage({ gameId }: { gameId: ApiTypes.GameId }): ReactElement {
  const logger = useLogger()
  const gameQuery = useLobbyQuery(gameId)

  if (gameQuery.isPending) {
    return <LobbyLoadingState />
  }

  if (gameQuery.isError) {
    logger.error("Could not fetch game", { gameId, error: gameQuery.error.message })
    return <Navigate to="/games" />
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <Game game={gameQuery.data} />
    </div>
  )
}

function Game({ game }: { game: ApiTypes.Lobby }): ReactElement {
  const navigate = useNavigate()
  const joinGame = useJoinGameMutation()
  const leaveGame = useLeaveGameMutation()
  const startGame = useStartGameMutation()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={game.configuration.name} actions={<GameStatusBadge status={game.status} />} />
      <Card className="border border-border/60">
        <CardHeader>
          <CardTitle>Lobby details</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="grid gap-4 md:grid-cols-2">
            <DetailBlock label="Creator" value={game.creator.alias ?? `Player ${game.creator.id}`} />
            <DetailBlock label="Created" value={timeAgo(game.createdAt)} />
            {game.winnerAccountId !== null ? <DetailBlock label="Winner" value={getWinnerLabel(game)} /> : null}
          </div>
          <Separator />
          <div className="space-y-3">
            <div className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
              Players ({game.players.length}/{game.configuration.nbSeats})
            </div>
            <div className="grid gap-2">
              {game.players.map((player) => (
                <Player player={player} key={player.id} />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
      <GameConfiguration configuration={game.configuration} />
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
        {game.canOpen && (
          <Button
            variant="secondary"
            disabled={startGame.isPending}
            onClick={() => {
              void navigate({ to: "/games/$gameId/play", params: { gameId: game.id } })
            }}
          >
            Open game
          </Button>
        )}
      </div>
    </div>
  )
}

function GameConfiguration({ configuration }: { configuration: ApiTypes.Lobby["configuration"] }): ReactElement {
  return (
    <Card className="border border-border/60">
      <CardHeader>
        <CardTitle>Game configuration</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="grid gap-4 md:grid-cols-2">
          <DetailBlock label="Number of seats" value={`${configuration.nbSeats} players`} />
          <DetailBlock label="Time per turn" value={formatTurnInterval(configuration.turnIntervalSeconds)} />
          <DetailBlock label="Ruleset" value={configuration.ruleset.name} />
        </div>
      </CardContent>
    </Card>
  )
}

function DetailBlock({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">{label}</div>
      <div aria-label={label} className="text-sm text-foreground">
        {value}
      </div>
    </div>
  )
}

function Player({ player }: { player: ApiTypes.LobbyPlayer }): ReactElement {
  const colorLabel = formatPlayerColor(player.color)

  return (
    <div className="flex items-center gap-3 rounded-3xl border border-border/60 bg-muted/20 px-4 py-3">
      <span
        aria-label={`${colorLabel} player color`}
        className="size-3 shrink-0 rounded-full border border-foreground/20"
        style={{ backgroundColor: PLAYER_COLOR_HEX[player.color] }}
      />
      <div className="min-w-0 flex-1 font-medium text-foreground">{player.alias ?? `Player ${player.id}`}</div>
      <div className="text-xs text-muted-foreground">{colorLabel}</div>
    </div>
  )
}

function LobbyLoadingState(): ReactElement {
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

function getWinnerLabel(game: ApiTypes.Lobby): string {
  const winner = [game.creator, ...game.players].find((player) => player.id === game.winnerAccountId)
  if (winner === undefined) {
    return `Player ${game.winnerAccountId}`
  }

  return winner.alias ?? `Player ${winner.id}`
}

function formatTurnInterval(turnIntervalSeconds: number): string {
  return Temporal.Duration.from({ seconds: turnIntervalSeconds }).round({ largestUnit: "days" }).toLocaleString()
}
