import type { ReactElement } from "react"
import { Badge } from "@/components/badge.tsx"
import { Card, CardContent } from "@/components/card.tsx"
import { usePlayGameContext } from "@/features/play/PlayContext.tsx"
import { formatPlayerColor, PLAYER_COLOR_HEX } from "@/lib/playerColorHex.ts"

export function PlayersPage(): ReactElement {
  const { game, playerView } = usePlayGameContext()

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
            const colorLabel = formatPlayerColor(player.color)
            const isCurrentPlayer = player.id === playerView.player.id
            const isReady = isCurrentPlayer ? playerView.player.ready : playerView.opponents[player.id]?.ready

            return (
              <div key={player.id} className="flex items-center gap-3 rounded-3xl border border-border/60 bg-muted/20 px-4 py-3">
                <span
                  aria-label={`${colorLabel} player color`}
                  className="size-4 shrink-0 rounded-full border border-foreground/20"
                  style={{ backgroundColor: PLAYER_COLOR_HEX[player.color] }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="truncate font-medium text-foreground">{player.alias ?? `Player ${player.id}`}</div>
                    {isCurrentPlayer ? <Badge variant="secondary">You</Badge> : null}
                    <Badge variant={isReady ? "default" : "outline"}>{isReady ? "Ready" : "Not ready"}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">{colorLabel}</div>
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>
    </section>
  )
}
