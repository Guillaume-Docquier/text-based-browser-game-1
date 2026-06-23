import type * as ApiTypes from "@api-types"
import { Navigate, useNavigate } from "@tanstack/react-router"
import type { ReactElement } from "react"
import { Button } from "../../components/button.tsx"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/card.tsx"
import { Separator } from "../../components/separator.tsx"
import { Skeleton } from "../../components/skeleton.tsx"
import { useJoinGameMutation } from "../../lib/api/useJoinGameMutation.ts"
import { useLeaveGameMutation } from "../../lib/api/useLeaveGameMutation.ts"
import { useLobbyQuery } from "../../lib/api/useLobbyQuery.ts"
import { useStartGameMutation } from "../../lib/api/useStartGameMutation.ts"
import { formatLobbyStatus } from "../../lib/formatLobbyStatus.ts"
import { useLogger } from "../../lib/LoggerContext.tsx"
import { timeAgo } from "../../lib/timeAgo.ts"
import { PageHeader } from "../PageHeader.tsx"
import { GameStatusBadge } from "../play/components/GameStatusBadge.tsx"
import { RANGE_SETTING_LABELS } from "./rangeSettingLabels.ts"

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
      <PageHeader
        title={game.configuration.name}
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
            <DetailBlock label="Status" value={formatLobbyStatus(game.status)} />
            <DetailBlock label="Seats" value={`${game.players.length}/${game.configuration.nbSeats} players`} />
            <div className="space-y-1">
              <div className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">Creator</div>
              <Player player={game.creator} />
            </div>
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
        {game.status === "STARTED" && (
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
          <DetailBlock label="Time per tick" value={formatTickInterval(configuration.tickIntervalSeconds)} />
        </div>
        <Separator />
        <div className="space-y-4">
          <div className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">Star map</div>
          <div className="grid gap-4 md:grid-cols-2">
            {Object.entries(RANGE_SETTING_LABELS).map(([key, metadata]) => {
              // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Object.entries does not preserve the object's key type
              const settingKey = key as ApiTypes.RangeSettingKey

              return (
                <DetailBlock
                  key={settingKey}
                  label={metadata.label}
                  value={formatRange(configuration.starSystemGenerationSettings[settingKey])}
                />
              )
            })}
            <DetailBlock label="Generation seed" value={configuration.starSystemGenerationSettings.seed.toString()} />
          </div>
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
  return (
    <div className="rounded-3xl border border-border/60 bg-muted/20 px-4 py-3">
      <div className="font-medium text-foreground">{player.alias ?? `Player ${player.id}`}</div>
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

function formatRange(value: ApiTypes.StarSystemGenerationSettings[ApiTypes.RangeSettingKey]): string {
  return value.min === value.max ? value.min.toString() : `${value.min}–${value.max}`
}

function formatTickInterval(tickIntervalSeconds: number): string {
  return Temporal.Duration.from({ seconds: tickIntervalSeconds }).round({ largestUnit: "days" }).toLocaleString()
}
