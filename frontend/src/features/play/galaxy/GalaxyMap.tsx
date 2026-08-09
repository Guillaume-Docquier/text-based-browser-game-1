import type { Galaxy, StarSystem } from "@api-types"
import type { KeyboardEvent, ReactElement } from "react"
import { useMapPanZoom } from "@/features/play/galaxy/useMapPanZoom.ts"

const GALAXY_SIZE = 1_000
const GALAXY_PADDING = 25
const GALAXY_MAP_SIZE = GALAXY_SIZE + GALAXY_PADDING * 2
const GALAXY_VIEWPORT_CENTER = { x: GALAXY_SIZE / 2, y: GALAXY_SIZE / 2 }
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
  const panZoom = useMapPanZoom({ resetSignal, viewportCenter: GALAXY_VIEWPORT_CENTER })

  function selectSystem(system: StarSystem): void {
    panZoom.centerOn({ x: system.star.x * LIGHT_YEAR_SIZE, y: system.star.y * LIGHT_YEAR_SIZE }, () => {
      onSelectSystem(system)
    })
  }

  return (
    <svg
      aria-label="Galaxy map"
      aria-busy={panZoom.isCentering}
      role="group"
      viewBox={`${-GALAXY_PADDING} ${-GALAXY_PADDING} ${GALAXY_MAP_SIZE} ${GALAXY_MAP_SIZE}`}
      className={`size-full touch-none select-none ${panZoom.isPanning ? "cursor-grabbing" : "cursor-grab"} ${
        panZoom.isCentering ? "pointer-events-none" : ""
      }`}
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
          <rect x={-GALAXY_PADDING} y={-GALAXY_PADDING} width={GALAXY_MAP_SIZE} height={GALAXY_MAP_SIZE} />
        </clipPath>
      </defs>
      <g
        transform={panZoom.transform}
        clipPath="url(#galaxy-bounds)"
        className={panZoom.isCentering ? "transition-transform ease-in-out" : undefined}
        style={panZoom.isCentering ? { transitionDuration: `${panZoom.centeringDurationMs}ms` } : undefined}
        onTransitionEnd={panZoom.onTransformTransitionEnd}
      >
        <rect x={-GALAXY_PADDING} y={-GALAXY_PADDING} width={GALAXY_MAP_SIZE} height={GALAXY_MAP_SIZE} fill="#05080f" />
        <GalaxyGrid />
        {galaxy.systems.map((system) => (
          <GalaxyStar key={system.star.id} system={system} onSelect={selectSystem} />
        ))}
      </g>
    </svg>
  )
}

function GalaxyGrid(): ReactElement {
  return (
    <g aria-hidden="true">
      {MINOR_GRID_LINES.map((coordinate) => (
        <GalaxyGridLines key={`minor-${coordinate}`} coordinate={coordinate} prominence="minor" />
      ))}
      {MAJOR_GRID_LINES.map((coordinate) => (
        <GalaxyGridLines key={`major-${coordinate}`} coordinate={coordinate} prominence="major" />
      ))}
    </g>
  )
}

function GalaxyGridLines({ coordinate, prominence }: { coordinate: number; prominence: "minor" | "major" }): ReactElement {
  return (
    <g>
      <GalaxyGridLine x1={coordinate} y1={0} x2={coordinate} y2={GALAXY_SIZE} prominence={prominence} />
      <GalaxyGridLine x1={0} y1={coordinate} x2={GALAXY_SIZE} y2={coordinate} prominence={prominence} />
    </g>
  )
}

function GalaxyGridLine({
  x1,
  y1,
  x2,
  y2,
  prominence,
}: {
  x1: number
  y1: number
  x2: number
  y2: number
  prominence: "minor" | "major"
}): ReactElement {
  const isMajor = prominence === "major"

  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={isMajor ? "#a9c2dc" : "#8ba3bd"}
      strokeOpacity={isMajor ? 0.2 : 0.08}
      strokeWidth={isMajor ? 1.5 : undefined}
      vectorEffect="non-scaling-stroke"
    />
  )
}

function GalaxyStar({ system, onSelect }: { system: StarSystem; onSelect: (system: StarSystem) => void }): ReactElement {
  const x = system.star.x * LIGHT_YEAR_SIZE
  const y = system.star.y * LIGHT_YEAR_SIZE

  function selectSystem(): void {
    onSelect(system)
  }

  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`View ${system.star.name} Star System`}
      className="group/star cursor-pointer outline-none"
      onClick={selectSystem}
      onKeyDown={(event) => {
        activateWithKeyboard(event, selectSystem)
      }}
    >
      <title>{system.star.name}</title>
      <circle
        cx={x}
        cy={y}
        r="1.5"
        fill="url(#galaxy-star-glow)"
        className="pointer-events-none origin-center transition-transform duration-200 ease-out [transform-box:fill-box] group-hover/star:scale-150 group-focus/star:scale-150"
      />
      <circle
        cx={x}
        cy={y}
        r="1.5"
        fill="url(#galaxy-star-glow)"
        opacity="0"
        className="pointer-events-none origin-center transition-[opacity,transform] duration-200 ease-out [transform-box:fill-box] group-hover/star:scale-[1.9] group-hover/star:opacity-80 group-focus/star:scale-[1.9] group-focus/star:opacity-80"
      />
      <circle
        cx={x}
        cy={y}
        r="0.5"
        fill="#fde047"
        stroke="#fde047"
        strokeWidth="0.5"
        className="pointer-events-none origin-center transition-[fill,transform] duration-200 ease-out [transform-box:fill-box] group-hover/star:scale-150 group-hover/star:fill-yellow-100 group-focus/star:scale-150 group-focus/star:fill-yellow-100"
      />
      {/* Provides a larger pointer and keyboard focus target without changing the visible star. */}
      <circle
        cx={x}
        cy={y}
        r="1.5"
        fill="transparent"
        stroke="transparent"
        strokeWidth="0.15"
        className="transition-colors duration-200 group-focus/star:stroke-white"
      />
    </g>
  )
}

function activateWithKeyboard(event: KeyboardEvent<SVGGElement>, activate: () => void): void {
  if (event.key !== "Enter" && event.key !== " ") {
    return
  }

  event.preventDefault()
  activate()
}
