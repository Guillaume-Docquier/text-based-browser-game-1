import type { ReactElement } from "react"
import type { TravelBody, TravelRoute, Trip } from "shared/domain/world/ships/travel.ts"
import { traveledDistance, tripPosition } from "shared/domain/world/ships/travel.ts"
import { formatCredits } from "@/lib/formatCredits.ts"

export function travelNumber(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumSignificantDigits: 8 }).format(value)
}
export function bodyLabel(body: TravelBody): string {
  return `${body.name} · ${body.coordinates}`
}
function Fact({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/45 py-2">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="break-words text-right text-sm font-medium tabular-nums">{value}</dd>
    </div>
  )
}
export function RouteFacts({ route }: { route: TravelRoute }): ReactElement {
  return (
    <dl>
      <Fact label="Destination" value={bodyLabel(route.destination)} />
      <Fact label="Distance" value={`${travelNumber(route.distance)} LY`} />
      <Fact label="Departure speed" value={`${travelNumber(route.speed)} LY per turn`} />
      <Fact label="Travel time" value={`${route.turns} ${route.turns === 1 ? "turn" : "turns"}`} />
      <Fact label="Full price" value={`${formatCredits(route.cost)} credits`} />
    </dl>
  )
}
export function UnderwayDetails({ trip }: { trip: Trip }): ReactElement {
  const { route, completedTurns } = trip
  const position = tripPosition(trip)
  const traveled = traveledDistance(route, completedTurns)
  return (
    <section aria-label="Trip in progress">
      <h3 className="font-heading text-lg font-semibold">Underway</h3>
      <dl>
        <Fact label="Current position" value={`x ${travelNumber(position.x)}, y ${travelNumber(position.y)} LY`} />
        <Fact label="Destination" value={bodyLabel(route.destination)} />
        <Fact label="Traveled" value={`${travelNumber(traveled)} of ${travelNumber(route.distance)} LY`} />
        <Fact label="Remaining distance" value={`${travelNumber(route.distance - traveled)} LY`} />
        <Fact label="Turns remaining" value={String(route.turns - completedTurns)} />
      </dl>
    </section>
  )
}
