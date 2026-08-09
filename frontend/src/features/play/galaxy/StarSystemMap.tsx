import type { PlanetBiome, PlanetSize, StarSystem } from "@api-types"
import type { KeyboardEvent, ReactElement } from "react"
import { useMapPanZoom } from "@/features/play/galaxy/useMapPanZoom.ts"

const CENTER = 500
const VIEWPORT_CENTER = { x: CENTER, y: CENTER }
const STAR_RADIUS = 18
const INNER_ORBIT_RADIUS = 90
const OUTER_ORBIT_RADIUS = 420
const PLANET_COLORS = {
  OCEANIC: "#0ea5e9",
  METALLIC: "#94a3b8",
  FROZEN: "#bfdbfe",
  VOLCANIC: "#f97316",
} as const satisfies Record<PlanetBiome, `#${string}`>
const PLANET_RADII = {
  SMALL: STAR_RADIUS / 4,
  MEDIUM: STAR_RADIUS / 3,
  LARGE: STAR_RADIUS / 2,
} as const satisfies Record<PlanetSize, number>

type PlanetViewModel = {
  id: number
  name: string
  biome: PlanetBiome
  size: PlanetSize
  radius: number
  color: `#${string}`
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
  const panZoom = useMapPanZoom({ resetSignal, viewportCenter: VIEWPORT_CENTER })
  const planets = toPlanetViewModels(system)

  function selectGalaxy(): void {
    panZoom.centerOn(VIEWPORT_CENTER, onSelectGalaxy)
  }

  return (
    <svg
      aria-label={`${system.star.name} Star System map`}
      aria-busy={panZoom.isCentering}
      role="group"
      viewBox="0 0 1000 1000"
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
        <radialGradient id="system-star-glow">
          <stop offset="0%" stopColor="#fde047" stopOpacity="0.55" />
          <stop offset="45%" stopColor="#facc15" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#facc15" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g
        transform={panZoom.transform}
        className={panZoom.isCentering ? "transition-transform ease-in-out" : undefined}
        style={panZoom.isCentering ? { transitionDuration: `${panZoom.centeringDurationMs}ms` } : undefined}
        onTransitionEnd={panZoom.onTransformTransitionEnd}
      >
        <rect width="1000" height="1000" fill="#05080f" />
        {planets.map((planet) => (
          <OccupiedOrbit key={`orbit-${planet.id}`} radius={planet.orbitRadius} />
        ))}
        <Star name={system.star.name} onSelect={selectGalaxy} />
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
      className="group/star cursor-pointer outline-none"
      onClick={onSelect}
      onKeyDown={(event) => {
        activateWithKeyboard(event, onSelect)
      }}
    >
      <circle
        cx={CENTER}
        cy={CENTER}
        r={STAR_RADIUS * 3}
        fill="url(#system-star-glow)"
        className="pointer-events-none origin-center transition-transform duration-200 ease-out [transform-box:fill-box] group-hover/star:scale-125 group-focus/star:scale-125"
      />
      <circle
        cx={CENTER}
        cy={CENTER}
        r={STAR_RADIUS * 3}
        fill="url(#system-star-glow)"
        opacity="0"
        className="pointer-events-none origin-center transition-[opacity,transform] duration-200 ease-out [transform-box:fill-box] group-hover/star:scale-150 group-hover/star:opacity-80 group-focus/star:scale-150 group-focus/star:opacity-80"
      />
      <circle
        cx={CENTER}
        cy={CENTER}
        r={STAR_RADIUS}
        fill="#fde047"
        stroke="#fef9c3"
        strokeWidth="2"
        className="pointer-events-none origin-center transition-[fill,transform] duration-200 ease-out [transform-box:fill-box] group-hover/star:scale-125 group-hover/star:fill-yellow-100 group-focus/star:scale-125 group-focus/star:fill-yellow-100"
      />
      <MapLabel x={CENTER + STAR_RADIUS + 12} y={CENTER} text={name} />
      {/* Provides a larger pointer and keyboard focus target without changing the visible star. */}
      <circle
        cx={CENTER}
        cy={CENTER}
        r={STAR_RADIUS + 10}
        fill="transparent"
        stroke="transparent"
        strokeWidth="2"
        className="transition-colors duration-200 group-focus/star:stroke-white"
      />
    </g>
  )
}

function Planet({ planet }: { planet: PlanetViewModel }): ReactElement {
  return (
    <g role="img" aria-label={`${planet.name}, ${planet.size.toLowerCase()} ${planet.biome.toLowerCase()} planet`}>
      <circle
        cx={planet.x}
        cy={planet.y}
        r={planet.radius}
        fill={planet.color}
        stroke="#e2e8f0"
        strokeWidth="1"
        data-biome={planet.biome}
        data-size={planet.size}
      />
      <MapLabel x={planet.x + planet.radius + 8} y={planet.y} text={planet.name} />
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
      biome: planet.biome,
      size: planet.size,
      radius: PLANET_RADII[planet.size],
      color: PLANET_COLORS[planet.biome],
      orbitRadius,
      x: CENTER + offsetX * directionScale,
      y: CENTER + offsetY * directionScale,
    }
  })
}
