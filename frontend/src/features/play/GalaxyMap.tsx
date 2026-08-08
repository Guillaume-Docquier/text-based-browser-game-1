import type { Galaxy, StarSystem } from "@api-types"
import type { KeyboardEvent, ReactElement } from "react"
import { useMapPanZoom } from "@/features/play/useMapPanZoom.ts"

const GALAXY_SIZE = 1_000
const LIGHT_YEAR_SIZE = 10
const MINOR_GRID_LINES = Array.from({ length: 99 }, (_, index) => index + 1)
  .filter((index) => index % 10 !== 0)
  .map((index) => index * LIGHT_YEAR_SIZE)
const MAJOR_GRID_LINES = Array.from({ length: 11 }, (_, index) => index * LIGHT_YEAR_SIZE * 10)

/**
 * Renders the galaxy-wide star map.
 *
 * @param galaxy - The galaxy visible to the player.
 * @param resetSignal - A value whose changes reset pan and zoom.
 * @param onSelectSystem - Selects a Star System for inspection.
 * @returns The interactive SVG galaxy map.
 */
export function GalaxyMap({
  galaxy,
  resetSignal,
  onSelectSystem,
}: {
  galaxy: Galaxy
  resetSignal: number
  onSelectSystem: (system: StarSystem) => void
}): ReactElement {
  const panZoom = useMapPanZoom({ resetSignal })

  return (
    <svg
      aria-label="Galaxy map"
      role="group"
      viewBox="-25 -25 1050 1050"
      className={`size-full touch-none select-none ${panZoom.isPanning ? "cursor-grabbing" : "cursor-grab"}`}
      onPointerCancel={panZoom.onPointerCancel}
      onPointerDown={panZoom.onPointerDown}
      onPointerMove={panZoom.onPointerMove}
      onPointerUp={panZoom.onPointerUp}
      onWheel={panZoom.onWheel}
    >
      <defs>
        <radialGradient id="galaxy-star-glow">
          <stop offset="0%" stopColor="#fde047" stopOpacity="0.5" />
          <stop offset="45%" stopColor="#facc15" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#facc15" stopOpacity="0" />
        </radialGradient>
        <clipPath id="galaxy-bounds">
          <rect width={GALAXY_SIZE} height={GALAXY_SIZE} />
        </clipPath>
      </defs>
      <g transform={panZoom.transform} clipPath="url(#galaxy-bounds)">
        <rect width={GALAXY_SIZE} height={GALAXY_SIZE} fill="#05080f" />
        <g aria-hidden="true">
          {MINOR_GRID_LINES.map((coordinate) => (
            <g key={`minor-${coordinate}`}>
              <line
                x1={coordinate}
                y1={0}
                x2={coordinate}
                y2={GALAXY_SIZE}
                stroke="#8ba3bd"
                strokeOpacity="0.08"
                vectorEffect="non-scaling-stroke"
              />
              <line
                x1={0}
                y1={coordinate}
                x2={GALAXY_SIZE}
                y2={coordinate}
                stroke="#8ba3bd"
                strokeOpacity="0.08"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          ))}
          {MAJOR_GRID_LINES.map((coordinate) => (
            <g key={`major-${coordinate}`}>
              <line
                x1={coordinate}
                y1={0}
                x2={coordinate}
                y2={GALAXY_SIZE}
                stroke="#a9c2dc"
                strokeOpacity="0.2"
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
              />
              <line
                x1={0}
                y1={coordinate}
                x2={GALAXY_SIZE}
                y2={coordinate}
                stroke="#a9c2dc"
                strokeOpacity="0.2"
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          ))}
        </g>
        {galaxy.systems.map((system) => {
          const x = system.star.x * LIGHT_YEAR_SIZE
          const y = system.star.y * LIGHT_YEAR_SIZE

          return (
            <g
              key={system.star.id}
              role="button"
              tabIndex={0}
              aria-label={`View ${system.star.name} Star System`}
              className="cursor-pointer outline-none [&>circle]:transition-colors hover:[&>circle:nth-of-type(2)]:fill-yellow-100 hover:[&>circle:last-of-type]:stroke-yellow-200 focus:[&>circle:last-of-type]:stroke-white"
              onClick={() => {
                onSelectSystem(system)
              }}
              onKeyDown={(event) => {
                activateWithKeyboard(event, () => {
                  onSelectSystem(system)
                })
              }}
            >
              <title>{system.star.name}</title>
              <circle cx={x} cy={y} r="1.5" fill="url(#galaxy-star-glow)" />
              <circle cx={x} cy={y} r="0.5" fill="#fde047" stroke="#fde047" strokeWidth="0.5" />
              {/* provides a bigger click area */}
              <circle cx={x} cy={y} r="2" fill="transparent" stroke="transparent" strokeWidth="1" />
            </g>
          )
        })}
      </g>
    </svg>
  )
}

function activateWithKeyboard(event: KeyboardEvent<SVGGElement>, activate: () => void): void {
  if (event.key !== "Enter" && event.key !== " ") {
    return
  }

  event.preventDefault()
  activate()
}
