import type { PlayerView } from "@api-types"
import { useMemo, useState, type ReactElement } from "react"
import { canAfford } from "shared/domain/games/credits.ts"
import { quoteTravel, type BodyRef, type TravelBody } from "shared/domain/world/ships/travel.ts"
import { Button } from "@/components/button.tsx"
import { usePlayGameContext } from "@/features/play/PlayContext.tsx"
import { useMoveShip } from "@/lib/api/useMoveShip.ts"
import { formatCredits } from "@/lib/formatCredits.ts"
import { bodyLabel, RouteFacts, travelNumber, UnderwayDetails } from "./TravelDetails.tsx"

type VisibleShip = PlayerView["ships"][number]
export function ShipsPage({
  initialShipId,
  bodyKind,
  bodyId,
  selectShip,
}: {
  selectShip: (id: string) => void
  initialShipId: string | undefined
  bodyKind: BodyRef["kind"] | undefined
  bodyId: string | undefined
}): ReactElement {
  const { playerView } = usePlayGameContext()
  const mine = playerView.ships.filter((ship) => ship.ownerPlayerId === playerView.player.id)
  const selectedId = initialShipId ?? mine[0]?.id ?? ""
  const sightings = playerView.ships.filter((ship) => ship.ownerPlayerId !== playerView.player.id && ship.position !== null)
  const selected = mine.find((ship) => ship.id === selectedId)
  const bodies = useMemo(
    () =>
      playerView.galaxy.systems.flatMap(({ star, planets }): TravelBody[] => [
        { kind: "star", id: star.id, coordinates: star.coordinates, name: star.name, x: star.x, y: star.y },
        ...planets.map((planet): TravelBody => ({
          kind: "planet",
          id: planet.id,
          coordinates: planet.coordinates,
          name: planet.name,
          x: planet.x,
          y: planet.y,
        })),
      ]),
    [playerView.galaxy],
  )
  const destination = bodies.find((body) => body.kind === bodyKind && body.id === bodyId)
  return (
    <section className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="max-w-2xl space-y-4">
        <h1 className="font-heading text-3xl font-semibold">Ships</h1>
        {destination !== undefined && <p className="font-medium">Move here · {bodyLabel(destination)}</p>}
        <label className="flex flex-wrap items-center gap-3 text-sm">
          Ship
          <select
            className="rounded border border-border bg-background px-3 py-2"
            value={selectedId}
            onChange={(event) => {
              selectShip(event.target.value)
            }}
          >
            {mine.map((ship) => (
              <option key={ship.id} value={ship.id}>
                Transport {ship.id} · {ship.trip === null ? "Stationed" : "Underway"}
              </option>
            ))}
          </select>
        </label>
        {selected !== undefined && <ShipMovement key={selected.id} ship={selected} bodies={bodies} initialDestination={destination} />}
        {sightings.length > 0 && (
          <section aria-label="Ship sightings" className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-heading text-lg font-semibold">Ship sightings</h2>
            <ul className="divide-y divide-border/50">
              {sightings.map((ship) => (
                <li key={ship.id} className="flex flex-wrap justify-between gap-3 py-2">
                  <span>Transport {ship.id}</span>
                  <span>{ship.position !== null && `x ${travelNumber(ship.position.x)}, y ${travelNumber(ship.position.y)} LY`}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </section>
  )
}
function ShipMovement({
  ship,
  bodies,
  initialDestination,
}: {
  ship: VisibleShip
  bodies: TravelBody[]
  initialDestination: TravelBody | undefined
}): ReactElement {
  const { playerView, canTakeAction } = usePlayGameContext()
  const mutation = useMoveShip(playerView.gameId)
  const target = { gameId: playerView.gameId, turn: playerView.turn }
  const [address, setAddress] = useState(initialDestination?.coordinates ?? "")
  const matches = address.trim() === "" ? [] : bodies.filter((body) => body.coordinates === address.trim())
  const destination = initialDestination?.coordinates === address ? initialDestination : matches.length === 1 ? matches[0] : undefined
  const origin = bodies.find((body) => (body.kind === "star" ? body.id === ship.starId : body.id === ship.planetId))
  const same = origin !== undefined && destination?.kind === origin.kind && origin.id === destination.id
  const draft = origin !== undefined && destination !== undefined && !same ? quoteTravel(origin, destination, ship, []) : undefined
  const route = ship.order?.route ?? draft
  const disabled = mutation.isPending || !canTakeAction
  return (
    <article aria-label={`Transport ${ship.id}`} className="space-y-4 rounded-xl border border-border/70 bg-card p-5">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-heading text-xl font-semibold">Transport {ship.id}</h2>
        <span className="text-sm tabular-nums">{formatCredits(playerView.availableCredits)} credits available</span>
      </header>
      {ship.trip !== null ? (
        <UnderwayDetails trip={ship.trip} />
      ) : (
        <>
          {origin !== undefined && (
            <p>
              <span className="text-muted-foreground">Current station</span> · {bodyLabel(origin)}
            </p>
          )}
          {ship.order === null && (
            <label className="block text-sm">
              Destination coordinates
              <input
                className="mt-1 block w-full rounded border border-border bg-background px-3 py-2"
                value={address}
                onChange={(event) => {
                  setAddress(event.target.value)
                }}
                disabled={disabled}
                placeholder="Enter a star or planet address"
              />
            </label>
          )}
          {ship.order === null && address !== "" && draft === undefined && (
            <p className="text-sm text-muted-foreground">
              {same
                ? "Choose a different body."
                : matches.length > 1
                  ? "Use Move here on the intended body to distinguish this address."
                  : "Enter a complete known address."}
            </p>
          )}
          {route !== undefined && (
            <section aria-label={ship.order === null ? "Move preview" : "Planned move"}>
              <h3 className="font-heading text-lg font-semibold">{ship.order === null ? "Move preview" : "Planned move"}</h3>
              <RouteFacts route={route} />
              {ship.order === null ? (
                <div className="mt-3 flex items-center gap-3">
                  <Button
                    disabled={disabled || !canAfford(playerView.availableCredits, route.cost)}
                    onClick={() => {
                      mutation.mutate({
                        ...target,
                        action: "submit",
                        shipId: ship.id,
                        destination: { kind: route.destination.kind, id: route.destination.id },
                      })
                    }}
                  >
                    Submit move
                  </Button>
                  {!canAfford(playerView.availableCredits, route.cost) && <span className="text-sm">Insufficient available credits.</span>}
                </div>
              ) : (
                <Button
                  className="mt-3"
                  variant="outline"
                  disabled={disabled}
                  onClick={() => {
                    if (ship.order !== null) {
                      mutation.mutate(
                        { ...target, action: "cancel", orderId: ship.order.id },
                        {
                          onSuccess: () => {
                            setAddress("")
                          },
                        },
                      )
                    }
                  }}
                >
                  Cancel move
                </Button>
              )}
            </section>
          )}
          {!canTakeAction && <p>Planning closed</p>}
        </>
      )}
      {mutation.error !== null && <p role="alert">{mutation.error.message}</p>}
    </article>
  )
}
