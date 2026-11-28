import type { GameDetails, Planet, PlayerView } from "@api-types"
import { Link } from "@tanstack/react-router"
import { Rocket } from "lucide-react"
import { useState, type ReactElement } from "react"
import { ShipType, type ShipId } from "shared/domain/world/ships/Ship.ts"
import { Button, buttonVariants } from "@/components/button.tsx"

const TYPE_NAMES = { [ShipType.TRANSPORT]: "Transport" } satisfies Record<ShipType, string>

export function ShipsAtPlanet({
  planet,
  ships,
  players,
  moveFor,
}: {
  planet: Planet
  ships: PlayerView["ships"]
  moveFor?: { gameId: GameDetails["id"]; playerId: PlayerView["player"]["id"] }
  players: GameDetails["players"]
}): ReactElement | null {
  const [selectedId, setSelectedId] = useState<ShipId>()
  const stationed = ships.filter((ship) => ship.planetId === planet.id)
  if (stationed.length === 0) {
    return null
  }
  const selected = stationed.find((ship) => ship.id === selectedId)
  const owner = players.find((player) => player.id === selected?.ownerPlayerId)
  return (
    <section aria-label="Ships at this planet" className="rounded-xl border border-border/70 bg-card px-5 py-4">
      <h2 className="font-heading text-lg font-semibold">Ships at this planet</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {stationed.map((ship) => (
          <Button
            key={ship.id}
            variant={ship.id === selectedId ? "secondary" : "outline"}
            size="sm"
            aria-pressed={ship.id === selectedId}
            onClick={() => {
              setSelectedId(ship.id)
            }}
          >
            <Rocket aria-hidden="true" />
            {TYPE_NAMES[ship.type]} {ship.id}
          </Button>
        ))}
      </div>
      {selected !== undefined && (
        <section aria-label="Ship details" className="mt-4 border-t border-border/60 pt-3">
          <h3 className="font-heading font-semibold">
            {TYPE_NAMES[selected.type]} {selected.id}
          </h3>
          <dl className="mt-1 divide-y divide-border/50">
            {[
              ["Owner", owner?.alias ?? selected.ownerPlayerId],
              ["Location", `${planet.name} · ${planet.coordinates}`],
              ["Type", TYPE_NAMES[selected.type]],
              ["Thrust", selected.thrust],
              ["Empty mass", selected.emptyMass],
              ["Cargo capacity", `${selected.cargoSize} slots`],
              ["Cargo", "Empty"],
            ].map(([name, value]) => (
              <div key={name} className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
                <dt className="text-muted-foreground">{name}</dt>
                <dd className="break-words text-right font-medium tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          {moveFor !== undefined && selected.ownerPlayerId === moveFor.playerId && (
            <Link
              to="/games/$gameId/play/ships"
              params={{ gameId: moveFor.gameId }}
              search={{ shipId: selected.id }}
              className={buttonVariants({ size: "sm", variant: "outline", className: "mt-3" })}
            >
              Move
            </Link>
          )}
        </section>
      )}
    </section>
  )
}
