import { CircleCheck, CircleDashed } from "lucide-react"
import type { ReactElement } from "react"
import { Badge } from "@/components/badge.tsx"
import { Button } from "@/components/button.tsx"
import { Card, CardContent } from "@/components/card.tsx"
import { usePlayGameContext } from "@/features/play/PlayContext.tsx"
import { useSetReadyMutation } from "@/lib/api/useSetReadyMutation.ts"
import { formatPlayerColor, PLAYER_COLOR_HEX } from "@/lib/playerColorHex.ts"

export function PlayersPage(): ReactElement {
  const { game, playerView } = usePlayGameContext()
  const setReady = useSetReadyMutation()

  return (
    <section className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8">
      <div className="mb-5">
        <h2 className="font-heading text-2xl font-semibold text-foreground">Players</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {game.players.length} {game.players.length === 1 ? "player" : "players"} in this game.
        </p>
      </div>
      <Card>
        <CardContent className="grid gap-2">
          {game.players.map((player) => {
            const isCurrentPlayer = player.id === playerView.player.id
            const ready = isCurrentPlayer ? playerView.player.ready : (playerView.opponents[player.id]?.ready ?? false)

            return (
              <PlayerRow
                key={player.id}
                alias={player.alias ?? "Player " + player.id}
                color={player.color}
                ready={ready}
                isCurrentPlayer={isCurrentPlayer}
                isPending={setReady.isPending}
                canToggle={playerView.turnStatus === "COLLECTING_ACTIONS"}
                onToggle={() => {
                  setReady.mutate({ gameId: playerView.gameId, ready: !ready })
                }}
              />
            )
          })}
        </CardContent>
      </Card>
    </section>
  )
}

function PlayerRow({
  alias,
  color,
  ready,
  isCurrentPlayer,
  isPending,
  canToggle,
  onToggle,
}: {
  alias: string
  color: keyof typeof PLAYER_COLOR_HEX
  ready: boolean
  isCurrentPlayer: boolean
  isPending: boolean
  canToggle: boolean
  onToggle: () => void
}): ReactElement {
  return (
    <div role="listitem" className="flex items-center gap-3 rounded-3xl border border-border/60 bg-muted/20 px-4 py-3">
      <ReadyStatus ready={ready} isCurrentPlayer={isCurrentPlayer} isPending={isPending} canToggle={canToggle} onToggle={onToggle} />
      <span
        aria-label={formatPlayerColor(color) + " player color"}
        className="size-4 shrink-0 rounded-full border border-foreground/20"
        style={{ backgroundColor: PLAYER_COLOR_HEX[color] }}
      />
      <div className="min-w-0 flex-1 truncate font-medium text-foreground">{alias}</div>
      {isCurrentPlayer ? <Badge variant="secondary">You</Badge> : null}
    </div>
  )
}

function ReadyStatus({
  ready,
  isCurrentPlayer,
  isPending,
  canToggle,
  onToggle,
}: {
  ready: boolean
  isCurrentPlayer: boolean
  isPending: boolean
  canToggle: boolean
  onToggle: () => void
}): ReactElement {
  const Icon = ready ? CircleCheck : CircleDashed
  const iconClassName = ready ? "text-emerald-400" : "text-muted-foreground"
  const label = ready ? "Ready" : "Not ready"

  if (!isCurrentPlayer) {
    return (
      <span aria-label={label} className="flex size-8 shrink-0 items-center justify-center">
        <Icon className={["size-5", iconClassName].join(" ")} aria-hidden="true" />
      </span>
    )
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={ready ? "Mark yourself not ready" : "Mark yourself ready"}
      aria-pressed={ready}
      disabled={isPending || !canToggle}
      onClick={onToggle}
      className="shrink-0"
    >
      <Icon className={["size-5", iconClassName].join(" ")} aria-hidden="true" />
    </Button>
  )
}
