import type { StarSystem } from "@api-types"
import type { ReactElement } from "react"
import { useMapPanZoom } from "@/features/play/useMapPanZoom.ts"

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
 * @returns The interactive SVG Star System map.
 */
export function StarSystemMap({ system, resetSignal }: { system: StarSystem; resetSignal: number }): ReactElement {
  const panZoom = useMapPanZoom({ resetSignal })
  const planets = toPlanetViewModels(system)

  return (
    <svg
      aria-label={`${system.star.name} Star System map`}
      role="img"
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
          <circle
            key={`orbit-${planet.id}`}
            cx={CENTER}
            cy={CENTER}
            r={planet.orbitRadius}
            fill="none"
            stroke="#67e8f9"
            strokeOpacity="0.18"
            strokeWidth="1.25"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <circle cx={CENTER} cy={CENTER} r={STAR_RADIUS * 3} fill="url(#system-star-glow)" />
        <circle cx={CENTER} cy={CENTER} r={STAR_RADIUS} fill="#fde047" stroke="#fef9c3" strokeWidth="2" />
        <MapLabel x={CENTER + STAR_RADIUS + 12} y={CENTER} text={system.star.name} />
        {planets.map((planet) => (
          <g key={planet.id}>
            <circle cx={planet.x} cy={planet.y} r={PLANET_RADIUS} fill="#22d3ee" stroke="#cffafe" strokeWidth="1" />
            <MapLabel x={planet.x + PLANET_RADIUS + 8} y={planet.y} text={planet.name} />
          </g>
        ))}
      </g>
    </svg>
  )
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
