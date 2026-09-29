import type { Fleet, LobbyPlayer, Planet as PlanetModel, PlanetSize, StarSystem } from "@api-types"
import { Distance, UnitOfDistance } from "@guillaume-docquier/tools-ts"
import type { KeyboardEvent, MouseEvent, ReactElement } from "react"
import { useId, useState } from "react"
import { flushSync } from "react-dom"
import starImage from "@/assets/planets/star-small.png"
import { FleetMarkers } from "@/features/play/galaxy/star-system/FleetMarkers.tsx"
import { getMovingFleetViews, MovingFleetMarkers, MovingFleetRoutes } from "@/features/play/galaxy/star-system/MovingFleetMarkers.tsx"
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
// Room outside the system boundary for Fleet icons and Strength labels.
const VIEW_PADDING = 60
const PLANET_RADII = {
  SMALL: 25,
  MEDIUM: 30,
  LARGE: 35,
} as const satisfies Record<PlanetSize, number>

type PlanetViewModel = PlanetModel & {
  radius: number
  orbitRadius: number
}

/**
 * Renders one Star System with its planets and occupied orbits.
 *
 * @param system - The Star System to render.
 * @param systems - The Galaxy's systems, used to locate both ends of a Fleet's route.
 * @param fleets - The Fleets visible in the Galaxy.
 * @param players - The players whose names and colors identify claimed Planets and Fleets.
 * @param resetSignal - A value whose changes reset pan and zoom.
 * @param onSelectGalaxy - Returns to the galaxy-wide map.
 * @param onSelectPlanet - Selects a Planet for inspection.
 * @returns The interactive SVG Star System map.
 */
export function StarSystemMap({
  system,
  systems,
  fleets,
  players,
  resetSignal,
  onSelectGalaxy,
  onSelectPlanet,
}: {
  system: StarSystem
  systems: readonly StarSystem[]
  fleets: readonly Fleet[]
  players: readonly LobbyPlayer[]
  resetSignal: number
  onSelectGalaxy: () => void
  onSelectPlanet: (planet: PlanetModel) => void
}): ReactElement {
  const panZoom = useMapPanZoom({ resetSignal, viewportCenter: VIEWPORT_CENTER })
  const [hoveredBody, setHoveredBody] = useState<string>()
  const planets = toPlanetViewModels(system)
  const outerOrbitRadius = planets.at(-1)?.orbitRadius ?? 0
  const boundaryRadius = outerOrbitRadius + ORBIT_SPACING * 2
  const boundaryDistance =
    Math.max(0, ...system.planets.map((planet) => Math.hypot(planet.x - system.star.x, planet.y - system.star.y))) +
    Distance.convert(Distance.create(ORBIT_SPACING_AU * 2, UnitOfDistance.ASTRONOMICAL_UNITS), UnitOfDistance.LIGHT_YEARS).value
  const viewRadius = boundaryRadius + VIEW_PADDING
  const movingFleets = getMovingFleetViews({
    system,
    systems,
    planets,
    fleets,
    players,
    boundaryRadius,
    boundaryDistance,
    center: CENTER,
  })

  function selectGalaxy(): void {
    panZoom.centerOn(VIEWPORT_CENTER, { onCentered: onSelectGalaxy })
  }

  const bodies = [
    <Star key="star" name={system.star.name} onSelect={selectGalaxy} />,
    ...planets.map((planet) => (
      <Planet
        key={`planet-${planet.id}`}
        planet={planet}
        fleets={fleets.filter((fleet) => fleet.originPlanetId === planet.id && fleet.destinationPlanetId === undefined)}
        players={players}
        ownerName={getPlanetOwnerName(planet, players)}
        onSelect={onSelectPlanet}
      />
    )),
  ]
  // SVG paints later siblings on top. Stable keys move the whole body without remounting it.
  const bodiesInPaintOrder = bodies.toSorted((first, second) => Number(first.key === hoveredBody) - Number(second.key === hoveredBody))

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
        <SystemBoundary radius={boundaryRadius} />
        <MovingFleetRoutes fleets={movingFleets} />
        {bodiesInPaintOrder.map((body) => (
          <g
            key={body.key}
            data-system-body=""
            onPointerEnter={() => {
              // Finish moving the group before pointerdown; moving it during a click cancels that click.
              flushSync(() => {
                setHoveredBody(String(body.key))
              })
            }}
            onPointerLeave={() => {
              setHoveredBody((current) => (current === body.key ? undefined : current))
            }}
          >
            {body}
          </g>
        ))}
        <MovingFleetMarkers fleets={movingFleets} />
      </g>
    </svg>
  )
}

function SystemBoundary({ radius }: { radius: number }): ReactElement {
  const glowFilterId = `system-boundary-${useId().replaceAll(":", "-")}`
  const filterRadius = radius + VIEW_PADDING

  return (
    <g data-system-boundary="" aria-hidden="true" className="pointer-events-none">
      <defs>
        <filter
          id={glowFilterId}
          filterUnits="userSpaceOnUse"
          x={CENTER - filterRadius}
          y={CENTER - filterRadius}
          width={filterRadius * 2}
          height={filterRadius * 2}
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>
      {/* Keep the luminous core sharp; only the separate halo is blurred. */}
      <g fill="none">
        <circle cx={CENTER} cy={CENTER} r={radius} stroke="#65baff" strokeWidth="5" strokeOpacity="0.25" filter={`url(#${glowFilterId})`} />
        <circle
          cx={CENTER}
          cy={CENTER}
          r={radius}
          stroke="#c9e8ff"
          strokeWidth="1.5"
          strokeOpacity="0.50"
          vectorEffect="non-scaling-stroke"
        />
        <circle
          cx={CENTER}
          cy={CENTER}
          r={radius + 8}
          stroke="#8fc8ef"
          strokeWidth="1.25"
          strokeOpacity="0.65"
          strokeDasharray="1 7 3 7"
          vectorEffect="non-scaling-stroke"
        />
      </g>
      <SystemBoundaryTicks radius={radius} />
    </g>
  )
}

function SystemBoundaryTicks({ radius }: { radius: number }): ReactElement {
  return (
    <g stroke="#b4d8f2" strokeWidth="1" strokeLinecap="square">
      {Array.from({ length: 36 }, (_, index) => {
        const isMajor = index % 3 === 0

        return (
          <g key={index} transform={`rotate(${index * 10} ${CENTER} ${CENTER})`} opacity={isMajor ? 0.85 : 0.55}>
            <line
              x1={CENTER}
              y1={CENTER - radius - 14}
              x2={CENTER}
              y2={CENTER - radius - (isMajor ? 30 : 22)}
              vectorEffect="non-scaling-stroke"
            />
            {isMajor && (
              <line x1={CENTER} y1={CENTER - radius + 6} x2={CENTER} y2={CENTER - radius + 18} vectorEffect="non-scaling-stroke" />
            )}
          </g>
        )
      })}
    </g>
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
      <image
        href={starImage}
        x={CENTER - STAR_RADIUS}
        y={CENTER - STAR_RADIUS}
        width={STAR_RADIUS * 2}
        height={STAR_RADIUS * 2}
        aria-hidden="true"
        className="pointer-events-none"
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
      <image
        href={PLANET_BIOME_IMAGES[planet.biome]}
        x={planet.x - planet.radius}
        y={planet.y - planet.radius}
        width={planet.radius * 2}
        height={planet.radius * 2}
        aria-hidden="true"
        data-biome={planet.biome}
        data-size={planet.size}
        className="pointer-events-none"
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
      orbitRadius,
      x: CENTER + Math.cos(angle) * orbitRadius,
      y: CENTER + Math.sin(angle) * orbitRadius,
    }
  })
}
