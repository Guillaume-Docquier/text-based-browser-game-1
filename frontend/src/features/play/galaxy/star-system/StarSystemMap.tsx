import type { Fleet, LobbyPlayer, Planet as PlanetModel, PlanetSize, StarSystem } from "@api-types"
import { Distance, UnitOfDistance } from "@guillaume-docquier/tools-ts"
import type { KeyboardEvent, MouseEvent, ReactElement } from "react"
import starImage from "@/assets/planets/star-small.png"
import { FleetMarkers } from "@/features/play/galaxy/star-system/FleetMarkers.tsx"
import { PLANET_BIOME_COLORS } from "@/features/play/galaxy/star-system/planetBiomeColors.ts"
import { PLANET_BIOME_IMAGES } from "@/features/play/galaxy/star-system/planetBiomeImages.ts"
import { useMapPanZoom } from "@/features/play/galaxy/useMapPanZoom.ts"
import { PLAYER_COLOR_HEX, UNCLAIMED_COLOR_HEX } from "@/lib/playerColorHex.ts"

const CENTER = 500
const VIEWPORT_CENTER = { x: CENTER, y: CENTER }
const STAR_RADIUS = 45
const INNER_ORBIT_RADIUS = 90
const ORBIT_SPACING = 70
// Generated orbital slots are 5 AU apart; preserve unoccupied slots in the display.
const ORBIT_SPACING_AU = 5
// Room outside the outermost body for owner labels, fleets, and hover effects.
const VIEW_PADDING = 50
const PLANET_RADII = {
  SMALL: 25,
  MEDIUM: 30,
  LARGE: 35,
} as const satisfies Record<PlanetSize, number>

type PlanetViewModel = PlanetModel & {
  radius: number
  color: `#${string}`
  orbitRadius: number
}

/**
 * Renders one Star System with its planets and occupied orbits.
 *
 * @param system - The Star System to render.
 * @param fleets - The Fleets stationed in the Star System.
 * @param players - The players whose names and colors identify claimed Planets and Fleets.
 * @param resetSignal - A value whose changes reset pan and zoom.
 * @param onSelectGalaxy - Returns to the galaxy-wide map.
 * @param onSelectPlanet - Selects a Planet for inspection.
 * @returns The interactive SVG Star System map.
 */
export function StarSystemMap({
  system,
  fleets,
  players,
  resetSignal,
  onSelectGalaxy,
  onSelectPlanet,
}: {
  system: StarSystem
  fleets: readonly Fleet[]
  players: readonly LobbyPlayer[]
  resetSignal: number
  onSelectGalaxy: () => void
  onSelectPlanet: (planet: PlanetModel) => void
}): ReactElement {
  const panZoom = useMapPanZoom({ resetSignal, viewportCenter: VIEWPORT_CENTER })
  const planets = toPlanetViewModels(system)
  const outerOrbitRadius = planets.at(-1)?.orbitRadius ?? 0
  const viewRadius = outerOrbitRadius + VIEW_PADDING

  function selectGalaxy(): void {
    panZoom.centerOn(VIEWPORT_CENTER, { onCentered: onSelectGalaxy })
  }

  return (
    <svg
      ref={panZoom.viewportRef}
      aria-label={`${system.star.name} Star System map`}
      aria-busy={panZoom.isCentering}
      role="group"
      viewBox={`${CENTER - viewRadius} ${CENTER - viewRadius} ${viewRadius * 2} ${viewRadius * 2}`}
      className={`size-full touch-none bg-[#05080f] select-none ${panZoom.isPanning ? "cursor-grabbing" : "cursor-grab"} ${
        panZoom.isCentering ? "pointer-events-none" : ""
      }`}
      onPointerCancel={panZoom.onPointerCancel}
      onPointerDown={panZoom.onPointerDown}
      onPointerMove={panZoom.onPointerMove}
      onPointerUp={panZoom.onPointerUp}
    >
      <g
        transform={panZoom.transform}
        className={panZoom.isCentering ? "transition-transform ease-in-out" : undefined}
        style={panZoom.isCentering ? { transitionDuration: `${panZoom.centeringDurationMs}ms` } : undefined}
        onTransitionEnd={panZoom.onTransformTransitionEnd}
      >
        {planets.map((planet) => (
          <OccupiedOrbit key={`orbit-${planet.id}`} radius={planet.orbitRadius} />
        ))}
        <Star name={system.star.name} onSelect={selectGalaxy} />
        {planets.map((planet) => (
          <Planet
            key={planet.id}
            planet={planet}
            fleets={fleets.filter((fleet) => fleet.originPlanetId === planet.id)}
            players={players}
            ownerName={getPlanetOwnerName(planet, players)}
            onSelect={onSelectPlanet}
          />
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
        r={STAR_RADIUS + 8}
        fill="#fde047"
        opacity="0"
        className="pointer-events-none origin-center transition-[opacity,transform] duration-200 ease-out [transform-box:fill-box] group-hover/star:scale-125 group-hover/star:opacity-25 group-focus/star:scale-125 group-focus/star:opacity-25"
      />
      <image
        href={starImage}
        x={CENTER - STAR_RADIUS}
        y={CENTER - STAR_RADIUS}
        width={STAR_RADIUS * 2}
        height={STAR_RADIUS * 2}
        aria-hidden="true"
        className="pointer-events-none origin-center transition-transform duration-200 ease-out [transform-box:fill-box] group-hover/star:scale-125 group-focus/star:scale-125"
      />
      <StarLabel x={CENTER} y={CENTER} text={name} />
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

function Planet({
  planet,
  fleets,
  players,
  ownerName,
  onSelect,
}: {
  planet: PlanetViewModel
  fleets: readonly Fleet[]
  players: readonly LobbyPlayer[]
  ownerName: string | undefined
  onSelect: (planet: PlanetModel) => void
}): ReactElement {
  const owner = players.find(({ id }) => id === planet.ownerPlayerId)
  const ownerColor = owner === undefined ? "#e5edf6" : PLAYER_COLOR_HEX[owner.color]

  function selectPlanet(event: MouseEvent<SVGGElement>): void {
    event.stopPropagation()
    onSelect(planet)
  }

  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`View ${planet.name} details${ownerName === undefined ? "" : `, owned by ${ownerName}`}`}
      className="group/planet cursor-pointer outline-none"
      onClick={selectPlanet}
      onKeyDown={(event) => {
        activateWithKeyboard(event, () => {
          onSelect(planet)
        })
      }}
    >
      <title>{`${planet.name}, ${planet.size.toLowerCase()} ${planet.biome.toLowerCase()} planet`}</title>
      <circle
        cx={planet.x}
        cy={planet.y}
        r={planet.radius + 8}
        fill={planet.color}
        opacity="0"
        className="pointer-events-none origin-center transition-[opacity,transform] duration-200 ease-out [transform-box:fill-box] group-hover/planet:scale-125 group-hover/planet:opacity-25 group-focus/planet:scale-125 group-focus/planet:opacity-25"
      />
      <image
        href={PLANET_BIOME_IMAGES[planet.biome]}
        x={planet.x - planet.radius}
        y={planet.y - planet.radius}
        width={planet.radius * 2}
        height={planet.radius * 2}
        aria-hidden="true"
        data-biome={planet.biome}
        data-size={planet.size}
        className="pointer-events-none origin-center transition-transform duration-200 ease-out [transform-box:fill-box] group-hover/planet:scale-125 group-focus/planet:scale-125"
      />
      <PlanetLabel planet={planet} ownerName={ownerName} ownerColor={ownerColor} />
      <FleetMarkers x={planet.x} y={planet.y + planet.radius + 30} fleets={fleets} players={players} />
      {/* Provides a larger pointer and keyboard focus target without changing the visible planet. */}
      <circle
        cx={planet.x}
        cy={planet.y}
        r={planet.radius + 10}
        fill="transparent"
        stroke="transparent"
        strokeWidth="2"
        className="transition-colors duration-200 group-focus/planet:stroke-white"
      />
    </g>
  )
}

function PlanetLabel({
  planet,
  ownerName,
  ownerColor,
}: {
  planet: PlanetViewModel
  ownerName: string | undefined
  ownerColor: string
}): ReactElement {
  return (
    <text
      x={planet.x}
      y={planet.y + planet.radius + 12}
      textAnchor="middle"
      dominantBaseline="hanging"
      fill={ownerName === undefined ? UNCLAIMED_COLOR_HEX : ownerColor}
      fontSize="16"
      fontWeight={ownerName === undefined ? "400" : "600"}
      paintOrder="stroke"
      stroke="#05080f"
      strokeWidth="4"
      strokeLinejoin="round"
    >
      {ownerName ?? "Unclaimed"}
    </text>
  )
}

function activateWithKeyboard(event: KeyboardEvent<SVGGElement>, activate: () => void): void {
  if (event.key !== "Enter" && event.key !== " ") {
    return
  }

  event.preventDefault()
  activate()
}

function StarLabel({ x, y, text }: { x: number; y: number; text: string }): ReactElement {
  return (
    <text
      x={x}
      y={y + STAR_RADIUS + 24}
      textAnchor="middle"
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

function getPlanetOwnerName(planet: PlanetModel, players: readonly LobbyPlayer[]): string | undefined {
  if (planet.ownerPlayerId === null) {
    return undefined
  }

  const owner = players.find(({ id }) => id === planet.ownerPlayerId)
  return owner?.alias ?? `Player ${planet.ownerPlayerId}`
}

function toPlanetViewModels(system: StarSystem): PlanetViewModel[] {
  const planetsByOrbit = system.planets
    .map((planet) => ({
      planet,
      angle: Math.atan2(planet.y - system.star.y, planet.x - system.star.x),
      distance: Math.hypot(planet.x - system.star.x, planet.y - system.star.y),
    }))
    .toSorted((firstPlanet, secondPlanet) => firstPlanet.distance - secondPlanet.distance)

  return planetsByOrbit.map(({ planet, angle, distance }) => {
    const distanceAu = Distance.convert(Distance.create(distance, UnitOfDistance.LIGHT_YEARS), UnitOfDistance.ASTRONOMICAL_UNITS).value
    const orbitIndex = Math.round(distanceAu / ORBIT_SPACING_AU) - 1
    const orbitRadius = INNER_ORBIT_RADIUS + ORBIT_SPACING * orbitIndex

    return {
      ...planet,
      radius: PLANET_RADII[planet.size],
      color: PLANET_BIOME_COLORS[planet.biome],
      orbitRadius,
      x: CENTER + Math.cos(angle) * orbitRadius,
      y: CENTER + Math.sin(angle) * orbitRadius,
    }
  })
}
