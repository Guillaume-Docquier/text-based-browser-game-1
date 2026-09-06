import type { Fleet } from "@api-types"
import type { ReactElement } from "react"

export function FleetMarkers({
  fleets,
  playerColors,
  x,
  y,
}: {
  fleets: readonly Fleet[]
  playerColors: Readonly<Record<string, string>>
  x: number
  y: number
}): ReactElement | null {
  if (fleets.length === 0) {
    return null
  }

  const spacing = 22
  const startX = x - ((fleets.length - 1) * spacing) / 2
  return (
    <g aria-label={`${fleets.length} fleet${fleets.length === 1 ? "" : "s"}`}>
      {fleets.map((fleet, index) => (
        <FleetMarker key={fleet.id} fleet={fleet} color={playerColors[fleet.playerId] ?? "#e5edf6"} x={startX + index * spacing} y={y} />
      ))}
    </g>
  )
}

function FleetMarker({ fleet, color, x, y }: { fleet: Fleet; color: string; x: number; y: number }): ReactElement {
  return (
    <g role="img" aria-label={`Fleet ${fleet.id}, strength ${fleet.strength}`} transform={`translate(${x} ${y})`}>
      <title>{`Fleet ${fleet.id}, strength ${fleet.strength}`}</title>
      <polygon points="0,-7 7,6 -7,6" fill={color} stroke="#05080f" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      <text x="0" y="14" textAnchor="middle" dominantBaseline="middle" fill="#e5edf6" fontSize="9" fontWeight="700">
        {fleet.strength}
      </text>
    </g>
  )
}
