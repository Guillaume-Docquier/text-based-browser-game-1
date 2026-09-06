import type { Fleet, Lobby, PlayerView } from "@api-types"
import { Link } from "@tanstack/react-router"
import { ArrowUpRight } from "lucide-react"
import type { ReactElement } from "react"
import { Badge } from "@/components/badge.tsx"
import { Card, CardContent } from "@/components/card.tsx"
import { usePlayGameContext } from "@/features/play/PlayContext.tsx"
import { PLAYER_COLOR_HEX } from "@/lib/playerColorHex.ts"

export function FleetsPage(): ReactElement {
  const { game, playerView } = usePlayGameContext()
  const planetsById = new Map(playerView.galaxy.systems.flatMap(({ planets }) => planets.map((planet) => [String(planet.id), planet])))
  const playersById = new Map<string, Lobby["players"][number]>(game.players.map((player) => [String(player.id), player]))
  const fleets = Object.values(playerView.fleets).toSorted((firstFleet, secondFleet) =>
    compareFleets(firstFleet, secondFleet, playerView, playersById),
  )

  return (
    <section className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8">
      <div className="mb-5">
        <h2 className="font-heading text-2xl font-semibold text-foreground">Fleets</h2>
        <p className="text-sm text-muted-foreground">Stationary fleets currently deployed in the galaxy.</p>
      </div>
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[38rem] text-left text-sm">
            <caption className="sr-only">Fleets in this game</caption>
            <thead className="border-b border-border/70 bg-muted/20 text-xs tracking-[0.16em] text-muted-foreground uppercase">
              <tr>
                <th scope="col" className="px-5 py-3 font-medium">
                  Owner
                </th>
                <th scope="col" className="px-5 py-3 font-medium">
                  Strength
                </th>
                <th scope="col" className="px-5 py-3 font-medium">
                  Position
                </th>
                <th scope="col" className="px-5 py-3 font-medium">
                  Origin planet
                </th>
              </tr>
            </thead>
            <tbody>
              {fleets.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-muted-foreground">
                    No fleets have been built yet.
                  </td>
                </tr>
              ) : (
                fleets.map((fleet) => {
                  const planet = planetsById.get(String(fleet.originPlanetId))
                  const player = playersById.get(String(fleet.playerId))
                  const isCurrentPlayer = fleet.playerId === playerView.player.id
                  return (
                    <tr key={fleet.id} className="border-b border-border/50 last:border-b-0">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <span
                            aria-label={player === undefined ? "Unknown player color" : player.color + " player color"}
                            className="size-3 rounded-full border border-foreground/20"
                            style={{ backgroundColor: player === undefined ? undefined : PLAYER_COLOR_HEX[player.color] }}
                          />
                          <span>{isCurrentPlayer ? "You" : (player?.alias ?? `Player ${fleet.playerId}`)}</span>
                          {isCurrentPlayer ? <Badge variant="secondary">You</Badge> : null}
                        </div>
                      </td>
                      <td className="px-5 py-4 font-semibold tabular-nums">{fleet.strength.toLocaleString()}</td>
                      <td className="px-5 py-4 text-muted-foreground">
                        {planet === undefined ? "Unknown planet" : `${planet.name} (${planet.coordinates})`}
                      </td>
                      <td className="px-5 py-4">
                        {planet === undefined ? (
                          "Unknown planet"
                        ) : (
                          <Link
                            to="/games/$gameId/play/galaxy"
                            params={{ gameId: game.id }}
                            search={{ planetId: planet.id }}
                            className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
                          >
                            {planet.name}
                            <ArrowUpRight className="size-3" aria-hidden="true" />
                          </Link>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </section>
  )
}

function compareFleets(
  firstFleet: Fleet,
  secondFleet: Fleet,
  playerView: PlayerView,
  playersById: Map<string, Lobby["players"][number]>,
): number {
  const firstIsCurrentPlayer = firstFleet.playerId === playerView.player.id
  const secondIsCurrentPlayer = secondFleet.playerId === playerView.player.id
  if (firstIsCurrentPlayer !== secondIsCurrentPlayer) {
    return firstIsCurrentPlayer ? -1 : 1
  }

  const firstOwner = playersById.get(String(firstFleet.playerId))?.alias ?? firstFleet.playerId
  const secondOwner = playersById.get(String(secondFleet.playerId))?.alias ?? secondFleet.playerId
  const ownerOrder = firstOwner.localeCompare(secondOwner)
  if (ownerOrder !== 0) {
    return ownerOrder
  }

  return firstFleet.id.localeCompare(secondFleet.id)
}
