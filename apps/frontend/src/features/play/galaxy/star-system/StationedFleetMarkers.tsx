import type { Fleet, Player } from "@api-types"
import { Assert } from "@guillaume-docquier/tools-ts"
import type { ReactElement } from "react"
import { FleetIcon } from "@/features/play/fleets/markers/FleetIcon.tsx"
import { PLAYER_COLOR_HEX } from "@/lib/playerColorHex.ts"

const MIN_SLOT_WIDTH = 44

/** Renders stationed Fleets in a centered row with each Fleet's visible Strength. */
export function StationedFleetMarkers({
  x,
  y,
  fleets,
  players,
}: {
  x: number
  y: number
  fleets: readonly Fleet[]
  players: readonly Player[]
}): ReactElement | null {
  if (fleets.length === 0) {
    return null
  }

  const ownersById = new Map(players.map((player) => [player.id, player]))
  const strengthLabels = fleets.map((fleet) => fleet.strength.toLocaleString())
  const slotWidths = strengthLabels.map((label) => Math.max(MIN_SLOT_WIDTH, label.length * 7 + 12))
  const totalWidth = slotWidths.reduce((sum, width) => sum + width, 0)
  const markerPositions: number[] = []
  let slotStart = -totalWidth / 2

  for (const slotWidth of slotWidths) {
    markerPositions.push(slotStart + slotWidth / 2)
    slotStart += slotWidth
  }

  return (
    <g transform={`translate(${x} ${y})`}>
      {fleets.map((fleet, index) => {
        const owner = ownersById.get(fleet.ownerPlayerId)
        const strengthLabel = strengthLabels[index]
        const markerX = markerPositions[index]
        Assert.isDefined(owner)
        Assert.isDefined(strengthLabel)
        Assert.isDefined(markerX)
        const color = PLAYER_COLOR_HEX[owner.color]

        return (
          <g
            key={fleet.id}
            role="img"
            aria-label={`${fleet.name}, ${owner.alias ?? `Player ${owner.id}`}, ${strengthLabel} strength`}
            data-fleet-marker={fleet.id}
            transform={`translate(${markerX} 0)`}
          >
            <FleetIcon color={color} />
            <text
              y="40"
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
