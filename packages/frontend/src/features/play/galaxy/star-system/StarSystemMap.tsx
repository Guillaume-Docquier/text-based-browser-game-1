import type { Player, Planet, StarSystem } from "@api-types"
import { Distance, UnitOfDistance } from "@guillaume-docquier/tools-ts"
import type { KeyboardEvent, MouseEvent, ReactElement } from "react"
import { useState } from "react"
import { flushSync } from "react-dom"
import { PlanetSize } from "shared/domain/world/planets/PlanetSize.ts"
import { SUN_ID } from "shared/domain/world/Sol.ts"
import type { StarId } from "shared/domain/world/stars/StarId.ts"
import starImage from "@/assets/planets/star-small.png"
import sunImage from "@/assets/planets/sun.png"
import { planetArtwork } from "@/features/play/galaxy/star-system/planetArtwork.ts"
import { useMapPanZoom } from "@/features/play/galaxy/useMapPanZoom.ts"
import { PLAYER_COLOR_HEX, UNCLAIMED_COLOR_HEX } from "@/lib/playerColorHex.ts"
import { observationLabel } from "../../observationLabel.ts"

const CENTER = 500
const VIEWPORT_CENTER = { x: CENTER, y: CENTER }
const STAR_RADIUS = 45
const INNER_ORBIT_RADIUS = 90
const ORBIT_SPACING = 70
const ORBIT_SPACING_AU = 5
const VIEW_PADDING = 60
const PLANET_RADII = {
  [PlanetSize.SMALL]: 25,
  [PlanetSize.MEDIUM]: 30,
  [PlanetSize.LARGE]: 35,
} as const satisfies Record<PlanetSize, number>

type PlanetViewModel = Planet & {
  radius: number
  orbitRadius: number
}

export function StarSystemMap({
  system,
  players,
  resetSignal,
  onSelectGalaxy,
  onSelectPlanet,
}: {
  system: StarSystem
  players: readonly Player[]
  resetSignal: number
  onSelectGalaxy: () => void
  onSelectPlanet: (planet: Planet) => void
}): ReactElement {
  const panZoom = useMapPanZoom({ resetSignal, viewportCenter: VIEWPORT_CENTER })
  const [hoveredBody, setHoveredBody] = useState<string>()
  const planets = toPlanetViewModels(system)
  const outerOrbitRadius = planets.at(-1)?.orbitRadius ?? 0
  const boundaryRadius = outerOrbitRadius + ORBIT_SPACING * 2
  const viewRadius = boundaryRadius + VIEW_PADDING
  function selectGalaxy(): void {
    panZoom.centerOn(VIEWPORT_CENTER, { onCentered: onSelectGalaxy })
  }

  const bodies = [
    <Star
      key="star"
      name={system.star.name}
      artwork={system.star.id === SUN_ID ? sunImage : starImage}
      coordinates={system.star.coordinates}
      onSelect={selectGalaxy}
    />,
    ...planets.map((planet) => (
      <Planet
        key={`planet-${planet.id}`}
        planet={planet}
        starId={system.star.id}
        players={players}
        ownerName={getPlanetOwnerName(planet, players)}
        onSelect={onSelectPlanet}
      />
    )),
  ]
  const bodiesInPaintOrder = bodies.toSorted((first, second) => Number(first.key === hoveredBody) - Number(second.key === hoveredBody))

  return (
    <svg
      ref={panZoom.viewportRef}
      aria-label={`${system.star.id === SUN_ID ? "Sol" : system.star.name} Star System map`}
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
        {bodiesInPaintOrder.map((body) => (
          <g
            key={body.key}
            data-system-body=""
            onPointerEnter={() => {
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

function Star({
  name,
  artwork,
  coordinates,
  onSelect,
}: {
  name: string
  artwork: string
  coordinates: string
  onSelect: () => void
}): ReactElement {
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
      <title>{`${name} · ${coordinates}`}</title>
      <image
        href={artwork}
        x={CENTER - STAR_RADIUS}
        y={CENTER - STAR_RADIUS}
        width={STAR_RADIUS * 2}
        height={STAR_RADIUS * 2}
        aria-hidden="true"
        className="pointer-events-none"
      />
      <StarLabel x={CENTER} y={CENTER} text={name} isSun={artwork === sunImage} />
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
  starId,
  players,
  ownerName,
  onSelect,
}: {
  planet: PlanetViewModel
  starId: StarId
  players: readonly Player[]
  ownerName: string | undefined
  onSelect: (planet: Planet) => void
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
      aria-label={`View ${planet.name} details${planet.observation === "remembered" ? `, ${observationLabel(planet)}` : ""}${ownerName === undefined ? "" : `, owned by ${ownerName}`}`}
      className="group/planet cursor-pointer outline-none"
      onClick={selectPlanet}
      onKeyDown={(event) => {
        activateWithKeyboard(event, () => {
          onSelect(planet)
        })
      }}
    >
      <title>{`${planet.name}, ${planet.size?.toLowerCase() ?? "Unknown size"} ${planet.biome?.toLowerCase() ?? "unknown biome"} planet · ${planet.coordinates} · ${observationLabel(planet)}`}</title>
      <image
        href={planetArtwork(planet, starId)}
        x={planet.x - planet.radius}
        y={planet.y - planet.radius}
        width={planet.radius * 2}
        height={planet.radius * 2}
        aria-hidden="true"
        data-biome={planet.biome ?? undefined}
        data-size={planet.size ?? undefined}
        className="pointer-events-none"
      />
      <PlanetLabel planet={planet} isSolar={starId === SUN_ID} ownerName={ownerName} ownerColor={ownerColor} />
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
  isSolar,
  ownerName,
  ownerColor,
}: {
  planet: PlanetViewModel
  isSolar: boolean
  ownerName: string | undefined
  ownerColor: string
}): ReactElement {
  return (
    <text
      x={planet.x}
      y={planet.y + planet.radius + 12}
      textAnchor="middle"
      dominantBaseline="hanging"
      fill={isSolar ? "#f1f5f9" : ownerName === undefined ? UNCLAIMED_COLOR_HEX : ownerColor}
      fontSize={isSolar ? 30 : 16}
      fontWeight={isSolar || ownerName !== undefined ? "600" : "400"}
      paintOrder="stroke"
      stroke="#05080f"
      strokeWidth="4"
      strokeLinejoin="round"
    >
      {planet.observation === "remembered" && "Last observed · "}
      {isSolar ? planet.name : (ownerName ?? (planet.observation === "unknown" ? "Unknown" : "Unclaimed"))}
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

function StarLabel({ x, y, text, isSun }: { x: number; y: number; text: string; isSun: boolean }): ReactElement {
  return (
    <text
      x={x}
      y={y + STAR_RADIUS + 24}
      textAnchor="middle"
      dominantBaseline="middle"
      fill="#e5edf6"
      fontSize={isSun ? 30 : 14}
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

function getPlanetOwnerName(planet: Planet, players: readonly Player[]): string | undefined {
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

  return planetsByOrbit.map(({ planet, angle, distance }, index) => {
    const distanceAu = Distance.convert(Distance.create(distance, UnitOfDistance.LIGHT_YEARS), UnitOfDistance.ASTRONOMICAL_UNITS).value
    const orbitIndex = system.star.id === SUN_ID ? index : Math.round(distanceAu / ORBIT_SPACING_AU) - 1
    const orbitRadius = INNER_ORBIT_RADIUS + ORBIT_SPACING * orbitIndex

    return {
      ...planet,
      radius: planet.size === null ? 30 : PLANET_RADII[planet.size],
      orbitRadius,
      x: CENTER + Math.cos(angle) * orbitRadius,
      y: CENTER + Math.sin(angle) * orbitRadius,
    }
  })
}
