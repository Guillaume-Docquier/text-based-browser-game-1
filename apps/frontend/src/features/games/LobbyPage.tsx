import type * as ApiTypes from "@api-types"
import { branded } from "@guillaume-docquier/tools-ts"
import { Navigate, useNavigate } from "@tanstack/react-router"
import type { ReactElement, ReactNode } from "react"
import { Button } from "@/components/button.tsx"
import { Card, CardContent } from "@/components/card.tsx"
import { Separator } from "@/components/separator.tsx"
import { Skeleton } from "@/components/skeleton.tsx"
import { PageHeader } from "@/features/PageHeader.tsx"
import { GameStatusBadge } from "@/features/play/components/GameStatusBadge.tsx"
import { useGameDetailsQuery } from "@/lib/api/useGameDetailsQuery.ts"
import { useJoinGameMutation } from "@/lib/api/useJoinGameMutation.ts"
import { useLeaveGameMutation } from "@/lib/api/useLeaveGameMutation.ts"
import { useStartGameMutation } from "@/lib/api/useStartGameMutation.ts"
import { useLogger } from "@/lib/LoggerContext.tsx"
import { formatPlayerColor, PLAYER_COLOR_HEX } from "@/lib/playerColorHex.ts"
import { timeAgo } from "@/lib/timeAgo.ts"

export function LobbyPage({ gameId }: { gameId: ApiTypes.GameId }): ReactElement {
  const logger = useLogger()
  const gameQuery = useGameDetailsQuery(gameId)

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

function Game({ game }: { game: ApiTypes.GameDetails }): ReactElement {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={game.configuration.name} />
      <Card className="border border-border/60">
        <CardContent className="flex flex-col gap-6">
          <div className="grid gap-4 md:grid-cols-3">
            <DetailBlock label="Creator" value={game.creator.alias} />
            <DetailBlock label="Created at" value={timeAgo(game.createdAt)} />
            <DetailBlock label="Status" value={<GameStatusBadge status={game.status} />} />
          </div>
          <GameConfiguration configuration={game.configuration} />
          {game.winnerAccountId !== null ? (
            <DetailBlock label="Winner" value={getWinnerLabel(branded(game.winnerAccountId), game)} />
          ) : null}
          <LobbyActions game={game} />
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
    </div>
  )
}

function LobbyActions({ game }: { game: ApiTypes.GameDetails }): ReactElement {
  const navigate = useNavigate()
  const joinGame = useJoinGameMutation()
  const leaveGame = useLeaveGameMutation()
  const startGame = useStartGameMutation()

  return (
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
          disabled={startGame.isPending}
          onClick={() => {
            void navigate({ to: "/games/$gameId/play", params: { gameId: game.id } })
          }}
        >
          Open game
        </Button>
      )}
    </div>
  )
}

function GameConfiguration({ configuration }: { configuration: ApiTypes.GameConfigurationDetails }): ReactElement {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <DetailBlock label="Number of seats" value={`${configuration.nbSeats} players`} />
      <DetailBlock label="Time per turn" value={formatTurnInterval(configuration.turnIntervalSeconds)} />
      <DetailBlock label="Ruleset" value={configuration.ruleset.name} />
    </div>
  )
}

function DetailBlock({ label, value }: { label: string; value: ReactNode }): ReactElement {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">{label}</div>
      <div aria-label={label} className="text-sm text-foreground">
        {value}
      </div>
    </div>
  )
}

function Player({ player }: { player: ApiTypes.GamePlayer }): ReactElement {
  const colorLabel = formatPlayerColor(player.color)

  return (
    <div className="flex items-center gap-3 rounded-3xl border border-border/60 bg-muted/20 px-4 py-3">
      <span
        aria-label={`${colorLabel} player color`}
        className="size-3 shrink-0 rounded-full border border-foreground/20"
        style={{ backgroundColor: PLAYER_COLOR_HEX[player.color] }}
      />
      <div className="min-w-0 flex-1 font-medium text-foreground">{player.alias}</div>
      <div className="text-xs text-muted-foreground">{colorLabel}</div>
    </div>
  )
}

function LobbyLoadingState(): ReactElement {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <PageHeader title="Loading game" description="Fetching lobby details and available actions." />
      <Card className="border border-border/60">
        <CardContent className="flex flex-col gap-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
          <Skeleton className="h-9 w-24 rounded-4xl" />
          <Skeleton className="h-px w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </CardContent>
      </Card>
    </div>
  )
}

function getWinnerLabel(winnerPlayerId: ApiTypes.PlayerId, game: ApiTypes.GameDetails): string {
  const winner = [game.creator, ...game.players].find((player) => player.id === winnerPlayerId)
  if (winner === undefined) {
    return `Player ${winnerPlayerId}`
  }

  return winner.alias
}

function formatTurnInterval(turnIntervalSeconds: number): string {
  return Temporal.Duration.from({ seconds: turnIntervalSeconds }).round({ largestUnit: "days" }).toLocaleString()
}
