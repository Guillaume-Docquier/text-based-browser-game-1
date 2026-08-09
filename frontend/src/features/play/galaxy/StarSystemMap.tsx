import type { StarSystem } from "@api-types"
import type { KeyboardEvent, ReactElement } from "react"
import { useMapPanZoom } from "@/features/play/galaxy/useMapPanZoom.ts"

const CENTER = 500
const STAR_RADIUS = 18
const PLANET_RADIUS = STAR_RADIUS / 3
const INNER_ORBIT_RADIUS = 90
const OUTER_ORBIT_RADIUS = 420

type PlanetViewModel = {
  id: number
  name: string
  orbitRadius: number
  x: number
  y: number
}

/**
 * Renders one Star System with its planets and occupied orbits.
 *
 * @param system - The Star System to render.
 * @param resetSignal - A value whose changes reset pan and zoom.
 * @param onSelectGalaxy - Returns to the galaxy-wide map.
 * @returns The interactive SVG Star System map.
 */
export function StarSystemMap({
  system,
  resetSignal,
  onSelectGalaxy,
}: {
  system: StarSystem
  resetSignal: number
  onSelectGalaxy: () => void
}): ReactElement {
  const panZoom = useMapPanZoom({ resetSignal })
  const planets = toPlanetViewModels(system)

  return (
    <svg
      aria-label={`${system.star.name} Star System map`}
      role="group"
      viewBox="0 0 1000 1000"
      className={`size-full touch-none select-none ${panZoom.isPanning ? "cursor-grabbing" : "cursor-grab"}`}
      onPointerCancel={panZoom.onPointerCancel}
      onPointerDown={panZoom.onPointerDown}
      onPointerMove={panZoom.onPointerMove}
      onPointerUp={panZoom.onPointerUp}
      onWheel={panZoom.onWheel}
    >
      <defs>
        <radialGradient id="system-star-glow">
          <stop offset="0%" stopColor="#fde047" stopOpacity="0.55" />
          <stop offset="45%" stopColor="#facc15" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#facc15" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g transform={panZoom.transform}>
        <rect width="1000" height="1000" fill="#05080f" />
        {planets.map((planet) => (
          <OccupiedOrbit key={`orbit-${planet.id}`} radius={planet.orbitRadius} />
        ))}
        <Star name={system.star.name} onSelect={onSelectGalaxy} />
        {planets.map((planet) => (
          <Planet key={planet.id} planet={planet} />
        ))}
      </g>
    </svg>
  )
}

function OccupiedOrbit({ radius }: { radius: number }): ReactElement {
  return (
    <circle
      cx={CENTER}
      cy={CENTER}
      r={radius}
      fill="none"
      stroke="#67e8f9"
      strokeOpacity="0.18"
      strokeWidth="1.25"
      vectorEffect="non-scaling-stroke"
    />
  )
}

function Star({ name, onSelect }: { name: string; onSelect: () => void }): ReactElement {
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`Return to Galaxy from ${name}`}
      className="cursor-pointer outline-none focus:[&>circle:last-of-type]:stroke-white"
      onClick={onSelect}
      onKeyDown={(event) => {
        activateWithKeyboard(event, onSelect)
      }}
    >
      <circle cx={CENTER} cy={CENTER} r={STAR_RADIUS * 3} fill="url(#system-star-glow)" />
      <circle cx={CENTER} cy={CENTER} r={STAR_RADIUS} fill="#fde047" stroke="#fef9c3" strokeWidth="2" />
      <MapLabel x={CENTER + STAR_RADIUS + 12} y={CENTER} text={name} />
      {/* Provides a larger pointer and keyboard focus target without changing the visible star. */}
      <circle cx={CENTER} cy={CENTER} r={STAR_RADIUS + 10} fill="transparent" stroke="transparent" strokeWidth="2" />
    </g>
  )
}

function Planet({ planet }: { planet: PlanetViewModel }): ReactElement {
  return (
    <g>
      <circle cx={planet.x} cy={planet.y} r={PLANET_RADIUS} fill="#22d3ee" stroke="#cffafe" strokeWidth="1" />
      <MapLabel x={planet.x + PLANET_RADIUS + 8} y={planet.y} text={planet.name} />
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

function MapLabel({ x, y, text }: { x: number; y: number; text: string }): ReactElement {
  return (
    <text
      x={x}
      y={y}
      dominantBaseline="middle"
      fill="#e5edf6"
      fontSize="14"
      fontWeight="500"
      paintOrder="stroke"
      stroke="#05080f"
      strokeWidth="4"
      strokeLinejoin="round"
    >
      {text}
    </text>
  )
}

function toPlanetViewModels(system: StarSystem): PlanetViewModel[] {
  const planetsByOrbit = system.planets
    .map((planet) => ({
      planet,
      offsetX: planet.x - system.star.x,
      offsetY: planet.y - system.star.y,
      distance: Math.hypot(planet.x - system.star.x, planet.y - system.star.y),
    }))
    .toSorted((firstPlanet, secondPlanet) => firstPlanet.distance - secondPlanet.distance)
  const orbitSpacing = planetsByOrbit.length <= 1 ? 0 : (OUTER_ORBIT_RADIUS - INNER_ORBIT_RADIUS) / (planetsByOrbit.length - 1)

  return planetsByOrbit.map(({ planet, offsetX, offsetY, distance }, index) => {
    const orbitRadius = INNER_ORBIT_RADIUS + orbitSpacing * index
    const directionScale = distance === 0 ? 0 : orbitRadius / distance

    return {
      id: planet.id,
      name: planet.name,
      orbitRadius,
      x: CENTER + offsetX * directionScale,
      y: CENTER + offsetY * directionScale,
    }
  })
}
