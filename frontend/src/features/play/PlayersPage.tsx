import { Assert } from "@guillaume-docquier/tools-ts"
import { Check, CircleDashed } from "lucide-react"
import type { ReactElement } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/alert.tsx"
import { Badge } from "@/components/badge.tsx"
import { Button } from "@/components/button.tsx"
import { Card, CardContent } from "@/components/card.tsx"
import { usePlayGameContext } from "@/features/play/PlayContext.tsx"
import { useUpdateReadiness } from "@/lib/api/useUpdateReadiness.ts"
import { formatPlayerColor, PLAYER_COLOR_HEX } from "@/lib/playerColorHex.ts"

export function PlayersPage(): ReactElement {
  const { game, playerView } = usePlayGameContext()
  const updateReadiness = useUpdateReadiness()

  return (
    <section className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8">
      <div className="mb-5">
        <h2 className="font-heading text-2xl font-semibold text-foreground">Players</h2>
      </div>
      <Card>
        <CardContent className="grid gap-2">
          {game.players.map((player) => {
            const colorLabel = formatPlayerColor(player.color)
            const isCurrentPlayer = player.id === playerView.player.id
            const playerState = isCurrentPlayer ? playerView.player : playerView.opponents[player.id]
            Assert.isDefined(playerState)
            const { isReady } = playerState

            return (
              <div key={player.id} className="flex items-center gap-3 rounded-3xl border border-border/60 bg-muted/20 px-4 py-3">
                {isCurrentPlayer ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Ready"
                    aria-pressed={isReady}
                    disabled={playerView.turnStatus !== "COLLECTING_ACTIONS" || updateReadiness.isPending}
                    onClick={() => {
                      updateReadiness.mutate({ gameId: game.id, turn: playerView.turn, isReady: !isReady })
                    }}
                  >
                    <ReadinessIcon isReady={isReady} />
                  </Button>
                ) : (
                  <span role="img" aria-label={isReady ? "Ready" : "Not ready"} className="flex size-9 items-center justify-center">
                    <ReadinessIcon isReady={isReady} />
                  </span>
                )}
                <span
                  aria-label={`${colorLabel} player color`}
                  className="size-4 shrink-0 rounded-full border border-foreground/20"
                  style={{ backgroundColor: PLAYER_COLOR_HEX[player.color] }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="truncate font-medium text-foreground">{player.alias ?? `Player ${player.id}`}</div>
                    {isCurrentPlayer ? <Badge variant="secondary">You</Badge> : null}
                  </div>
                  <div className="text-xs text-muted-foreground">{colorLabel}</div>
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>
      {updateReadiness.isError ? (
        <Alert variant="destructive" className="mt-4">
          <AlertTitle>Could not change readiness</AlertTitle>
          <AlertDescription>{updateReadiness.error.message}</AlertDescription>
        </Alert>
      ) : null}
    </section>
  )
}

function ReadinessIcon({ isReady }: { isReady: boolean }): ReactElement {
  return isReady ? (
    <Check aria-hidden="true" className="size-5 text-green-500" />
  ) : (
    <CircleDashed aria-hidden="true" className="size-5 text-muted-foreground" />
  )
}
