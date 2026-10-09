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

export function GameDetailsPage({ gameId }: { gameId: ApiTypes.GameId }): ReactElement {
  const logger = useLogger()
  const gameDetailsQuery = useGameDetailsQuery(gameId)

  if (gameDetailsQuery.isPending) {
    return <GameDetailsLoadingState />
  }

  if (gameDetailsQuery.isError) {
    logger.error("Could not fetch game", { gameId, error: gameDetailsQuery.error.message })
    return <Navigate to="/games" />
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <GameDetails gameDetails={gameDetailsQuery.data} />
    </div>
  )
}

function GameDetails({ gameDetails }: { gameDetails: ApiTypes.GameDetails }): ReactElement {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={gameDetails.configuration.name} />
      <Card className="border border-border/60">
        <CardContent className="flex flex-col gap-6">
          <div className="grid gap-4 md:grid-cols-3">
            <DetailBlock label="Creator" value={gameDetails.creator.alias} />
            <DetailBlock label="Created at" value={timeAgo(gameDetails.createdAt)} />
            <DetailBlock label="Status" value={<GameStatusBadge status={gameDetails.status} />} />
          </div>
          <GameConfigurationDetails gameConfigurationDetails={gameDetails.configuration} />
          {gameDetails.winnerAccountId !== null ? (
            <DetailBlock label="Winner" value={getWinnerLabel(branded(gameDetails.winnerAccountId), gameDetails)} />
          ) : null}
          <GameDetailsActions gameDetails={gameDetails} />
          <Separator />
          <div className="space-y-3">
            <div className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
              Players ({gameDetails.players.length}/{gameDetails.configuration.nbSeats})
            </div>
            <div className="grid gap-2">
              {gameDetails.players.map((player) => (
                <Player player={player} key={player.id} />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function GameDetailsActions({ gameDetails }: { gameDetails: ApiTypes.GameDetails }): ReactElement {
  const navigate = useNavigate()
  const joinGame = useJoinGameMutation()
  const leaveGame = useLeaveGameMutation()
  const startGame = useStartGameMutation()

  return (
    <div className="flex flex-wrap gap-3">
      {gameDetails.canJoin && (
        <Button
          disabled={joinGame.isPending}
          onClick={() => {
            joinGame.mutate({ gameId: gameDetails.id })
          }}
        >
          Join game
        </Button>
      )}
      {gameDetails.canLeave && (
        <Button
          variant="outline"
          disabled={leaveGame.isPending}
          onClick={() => {
            leaveGame.mutate({ gameId: gameDetails.id })
          }}
        >
          Leave game
        </Button>
      )}
      {gameDetails.canStart && (
        <Button
          disabled={startGame.isPending}
          onClick={() => {
            startGame.mutate({ gameId: gameDetails.id })
          }}
        >
          Start game
        </Button>
      )}
      {gameDetails.canOpen && (
        <Button
          disabled={startGame.isPending}
          onClick={() => {
            void navigate({ to: "/games/$gameId/play", params: { gameId: gameDetails.id } })
          }}
        >
          Open game
        </Button>
      )}
    </div>
  )
}

function GameConfigurationDetails({
  gameConfigurationDetails,
}: {
  gameConfigurationDetails: ApiTypes.GameConfigurationDetails
}): ReactElement {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <DetailBlock label="Number of seats" value={`${gameConfigurationDetails.nbSeats} players`} />
      <DetailBlock label="Time per turn" value={formatTurnInterval(gameConfigurationDetails.turnIntervalSeconds)} />
      <DetailBlock label="Ruleset" value={gameConfigurationDetails.ruleset.name} />
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

function Player({ player }: { player: ApiTypes.Player }): ReactElement {
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

function GameDetailsLoadingState(): ReactElement {
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

function getWinnerLabel(winnerPlayerId: ApiTypes.PlayerId, gameDetails: ApiTypes.GameDetails): string {
  const winner = [gameDetails.creator, ...gameDetails.players].find((player) => player.id === winnerPlayerId)
  if (winner === undefined) {
    return `Player ${winnerPlayerId}`
  }

  return winner.alias
}

function formatTurnInterval(turnIntervalSeconds: number): string {
  return Temporal.Duration.from({ seconds: turnIntervalSeconds }).round({ largestUnit: "days" }).toLocaleString()
}
