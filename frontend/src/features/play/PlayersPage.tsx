import type { LobbyPlayer } from "@api-types"
import { AlertTriangle, CircleCheck, CircleDashed, RefreshCw } from "lucide-react"
import type { ReactElement } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/alert.tsx"
import { Badge } from "@/components/badge.tsx"
import { Button } from "@/components/button.tsx"
import { Card, CardContent } from "@/components/card.tsx"
import { usePlayGameContext } from "@/features/play/PlayContext.tsx"
import { useRefreshClientData } from "@/lib/api/useRefreshClientData.ts"
import { useSetReadyMutation } from "@/lib/api/useSetReadyMutation.ts"
import { formatPlayerColor, PLAYER_COLOR_HEX } from "@/lib/playerColorHex.ts"

export function PlayersPage(): ReactElement {
  const { game, playerView } = usePlayGameContext()
  const refreshClientData = useRefreshClientData()
  const setReady = useSetReadyMutation()

  return (
    <section className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-2xl font-semibold text-foreground">Players</h2>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            void refreshClientData()
          }}
        >
          <RefreshCw />
          Refresh players
        </Button>
      </div>
      <Card>
        <CardContent className="grid gap-2">
          {game.players.map((player) => {
            const isCurrentPlayer = player.id === playerView.player.id
            const isReady = (isCurrentPlayer ? playerView.player.ready : playerView.opponents[player.id]?.ready) ?? false

            return (
              <PlayerRow
                key={player.id}
                player={player}
                isCurrentPlayer={isCurrentPlayer}
                isReady={isReady}
                isTogglingReady={setReady.isPending}
                onToggleReady={() => {
                  setReady.mutate({ gameId: game.id, ready: !isReady })
                }}
              />
            )
          })}
        </CardContent>
      </Card>
      {setReady.isError ? (
        <Alert variant="destructive" className="mt-4">
          <AlertTriangle className="size-4" />
          <AlertTitle>Could not update readiness</AlertTitle>
          <AlertDescription>{setReady.error.message}</AlertDescription>
        </Alert>
      ) : null}
    </section>
  )
}

function PlayerRow({
  player,
  isCurrentPlayer,
  isReady,
  isTogglingReady,
  onToggleReady,
}: {
  player: LobbyPlayer
  isCurrentPlayer: boolean
  isReady: boolean
  isTogglingReady: boolean
  onToggleReady: () => void
}): ReactElement {
  const colorLabel = formatPlayerColor(player.color)

  return (
    <div className="flex items-center gap-3 rounded-3xl border border-border/60 bg-muted/20 px-4 py-3">
      <ReadyStatus isReady={isReady} isCurrentPlayer={isCurrentPlayer} isTogglingReady={isTogglingReady} onToggleReady={onToggleReady} />
      <span
        aria-label={`${colorLabel} player color`}
        className="size-6 shrink-0 rounded-full border border-foreground/20"
        style={{ backgroundColor: PLAYER_COLOR_HEX[player.color] }}
      />
      <div className="truncate font-medium text-foreground">{player.alias ?? `Player ${player.id}`}</div>
      <YouBadge isCurrentPlayer={isCurrentPlayer} />
    </div>
  )
}

/**
 * The current player gets a clickable ready status, other players get just the icon
 */
function ReadyStatus({
  isReady,
  isCurrentPlayer,
  isTogglingReady,
  onToggleReady,
}: {
  isReady: boolean
  isCurrentPlayer: boolean
  isTogglingReady: boolean
  onToggleReady: () => void
}): ReactElement {
  if (!isCurrentPlayer) {
    return (
      <span className="flex size-8 items-center justify-center" aria-label={isReady ? "Ready" : "Not ready"}>
        <ReadyIcon isReady={isReady} />
      </span>
    )
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={isReady ? "Mark yourself not ready" : "Mark yourself ready"}
      aria-pressed={isReady}
      disabled={isTogglingReady}
      onClick={onToggleReady}
    >
      <ReadyIcon isReady={isReady} />
    </Button>
  )
}

function ReadyIcon({ isReady }: { isReady: boolean }): ReactElement {
  const Icon = isReady ? CircleCheck : CircleDashed
  return <Icon className={isReady ? "size-6 text-emerald-400" : "size-6 text-muted-foreground"} />
}

function YouBadge({ isCurrentPlayer }: { isCurrentPlayer: boolean }): ReactElement | null {
  return isCurrentPlayer ? <Badge className="border-primary bg-primary text-primary-foreground">You</Badge> : null
}
