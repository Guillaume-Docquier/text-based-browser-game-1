import type { ReactElement } from "react"
import { FleetIcon } from "@/features/play/fleets/markers/FleetIcon.tsx"
import type { MovingFleetView } from "@/features/play/fleets/markers/movingFleetViews.ts"
import { PLAYER_COLOR_HEX } from "@/lib/playerColorHex.ts"

/**
 * Renders traveled and remaining route segments in the map's projected coordinates.
 */
export function MovingFleetRoutes({ fleets }: { fleets: readonly MovingFleetView[] }): ReactElement {
  return (
    <g aria-hidden="true" className="pointer-events-none">
      {fleets.map(({ fleet, owner, start, position, end }) => {
        const color = PLAYER_COLOR_HEX[owner.color]

        return (
          <g key={fleet.id} data-fleet-route={fleet.id}>
            <line
              x1={start.x}
              y1={start.y}
              x2={position.x}
              y2={position.y}
              stroke={color}
              strokeOpacity="0.85"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1={position.x}
              y1={position.y}
              x2={end.x}
              y2={end.y}
              stroke={color}
              strokeOpacity="0.5"
              strokeWidth="1.5"
              strokeDasharray="4 4"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        )
      })}
    </g>
  )
}

/**
 * Renders destination-facing Fleet icons and Strength labels at the map's marker scale.
 */
export function MovingFleetMarkers({
  fleets,
  scale = 1,
  strengthLabelY = 40,
}: {
  fleets: readonly MovingFleetView[]
  scale?: number
  strengthLabelY?: number
}): ReactElement {
  return (
    <g className="pointer-events-none">
      {fleets.map(({ fleet, owner, origin, destination, markerPosition, heading, isOutsideSystem = false }) => {
        const strengthLabel = fleet.strength.toLocaleString()

        return (
          <g
            key={fleet.id}
            role="img"
            aria-label={`${fleet.name}, ${owner.alias ?? `Player ${owner.id}`}, ${strengthLabel} strength, traveling from ${origin.name} to ${destination.name}${isOutsideSystem ? ", outside this Star System" : ""}`}
            data-fleet-marker={fleet.id}
            transform={`translate(${markerPosition.x} ${markerPosition.y}) scale(${scale})`}
          >
            {isOutsideSystem && (
              <circle r="23" fill="#05080f" stroke={PLAYER_COLOR_HEX[owner.color]} strokeWidth="1.5" aria-hidden="true" />
            )}
            <g transform={`rotate(${heading}) translate(0 -12)`}>
              <FleetIcon color={PLAYER_COLOR_HEX[owner.color]} />
            </g>
            <text
              y={strengthLabelY}
              textAnchor="middle"
              fill="#f8fafc"
              fontSize="12"
              paintOrder="stroke"
              stroke="#05080f"
              strokeWidth="3"
              strokeLinejoin="round"
            >
              {strengthLabel}
            </text>
          </g>
        )
      })}
    </g>
  )
}
