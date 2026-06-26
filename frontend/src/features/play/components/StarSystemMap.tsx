import type { StarSystem, StarSystemBody } from "@api-types"
import { type ReactElement } from "react"
import {
  getOrbitRadii,
  getSatellitePosition,
  getSectorGeometry,
  STAR_SYSTEM_CENTER,
  STAR_SYSTEM_VIEW_BOX,
  type Point,
} from "@/features/play/starSystemGeometry.ts"
import { useStarSystemPanZoom } from "@/features/play/useStarSystemPanZoom.ts"

type RenderedSector = {
  id: string
  coordinates: string
  bodyCount: number
  path: string
}

type RenderedBody = {
  body: StarSystemBody
  position: Point
}

type RenderedSatelliteOrbit = {
  sectorId: string
  center: Point
  radius: number
}

type StarSystemRendering = {
  orbitOuterRadii: number[]
  sectors: RenderedSector[]
  bodies: RenderedBody[]
  satelliteOrbits: RenderedSatelliteOrbit[]
}

export function StarSystemMap({ starSystem, resetSignal }: { starSystem: StarSystem; resetSignal: number }): ReactElement {
  const orbitCount = starSystem.orbits.length
  const rendering = createStarSystemRendering(starSystem)
  const panZoom = useStarSystemPanZoom({ resetSignal })

  return (
    <svg
      aria-label={`Star system with ${orbitCount} orbits`}
      className={`block h-full w-full touch-none select-none ${panZoom.isPanning ? "cursor-grabbing" : "cursor-grab"}`}
      role="img"
      viewBox={STAR_SYSTEM_VIEW_BOX}
      onPointerCancel={panZoom.onPointerCancel}
      onPointerDown={panZoom.onPointerDown}
      onPointerMove={panZoom.onPointerMove}
      onPointerUp={panZoom.onPointerUp}
      onWheel={panZoom.onWheel}
    >
      <MapDefinitions />

      <g transform={panZoom.transform}>
        <Star />
        <Orbits outerRadii={rendering.orbitOuterRadii} />
        <Sectors sectors={rendering.sectors} />
        <Bodies bodies={rendering.bodies} satelliteOrbits={rendering.satelliteOrbits} />
      </g>
    </svg>
  )
}

function MapDefinitions(): ReactElement {
  return (
    <defs>
      <radialGradient id="star-core">
        <stop offset="0%" stopColor="#fff7c2" />
        <stop offset="48%" stopColor="#fbbf24" />
        <stop offset="100%" stopColor="#c2410c" />
      </radialGradient>
      <radialGradient id="planet-surface" cx="35%" cy="30%">
        <stop offset="0%" stopColor="#d9f99d" />
        <stop offset="55%" stopColor="#65a30d" />
        <stop offset="100%" stopColor="#365314" />
      </radialGradient>
      <radialGradient id="moon-surface" cx="35%" cy="30%">
        <stop offset="0%" stopColor="#f8fafc" />
        <stop offset="55%" stopColor="#94a3b8" />
        <stop offset="100%" stopColor="#475569" />
      </radialGradient>
      <filter id="star-glow" x="-100%" y="-100%" width="300%" height="300%">
        <feGaussianBlur stdDeviation="15" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  )
}

function Sectors({ sectors }: { sectors: RenderedSector[] }): ReactElement {
  return (
    <g aria-label="Sectors">
      {sectors.map((sector) => (
        <Sector key={sector.id} sector={sector} />
      ))}
    </g>
  )
}

function Sector({ sector }: { sector: RenderedSector }): ReactElement {
  return (
    <path
      aria-label={`Sector ${sector.coordinates}`}
      className="fill-white/[0.025] stroke-white/10 stroke-[1.25] transition-[fill,stroke,filter] duration-150 outline-none hover:fill-primary/20 hover:stroke-primary hover:[filter:drop-shadow(0_0_10px_rgb(251_191_36/0.7))] focus-visible:fill-primary/20 focus-visible:stroke-primary focus-visible:[filter:drop-shadow(0_0_10px_rgb(251_191_36/0.7))]"
      d={sector.path}
      tabIndex={0}
    >
      <title>{`Sector ${sector.coordinates} · ${sector.bodyCount} ${sector.bodyCount === 1 ? "body" : "bodies"}`}</title>
    </path>
  )
}

function Orbits({ outerRadii }: { outerRadii: number[] }): ReactElement {
  return (
    <g aria-hidden="true" className="pointer-events-none fill-none stroke-primary/25 stroke-2">
      {outerRadii.map((outerRadius) => (
        <circle key={outerRadius} cx={STAR_SYSTEM_CENTER.x} cy={STAR_SYSTEM_CENTER.y} r={outerRadius} />
      ))}
    </g>
  )
}

function Bodies({ bodies, satelliteOrbits }: { bodies: RenderedBody[]; satelliteOrbits: RenderedSatelliteOrbit[] }): ReactElement {
  return (
    <g aria-label="Bodies">
      {satelliteOrbits.map((satelliteOrbit) => (
        <SatelliteOrbit key={satelliteOrbit.sectorId} satelliteOrbit={satelliteOrbit} />
      ))}
      {bodies.map(({ body, position }) => (
        <Body key={body.id} body={body} position={position} />
      ))}
    </g>
  )
}

function SatelliteOrbit({ satelliteOrbit }: { satelliteOrbit: RenderedSatelliteOrbit }): ReactElement {
  return (
    <circle
      aria-hidden="true"
      className="pointer-events-none fill-none stroke-white/15"
      cx={satelliteOrbit.center.x}
      cy={satelliteOrbit.center.y}
      r={satelliteOrbit.radius}
    />
  )
}

function Star(): ReactElement {
  return (
    <g aria-label="Star" className="pointer-events-none">
      <circle className="fill-amber-500/15" cx={STAR_SYSTEM_CENTER.x} cy={STAR_SYSTEM_CENTER.y} filter="url(#star-glow)" r="55" />
      <circle cx={STAR_SYSTEM_CENTER.x} cy={STAR_SYSTEM_CENTER.y} fill="url(#star-core)" r="31" />
      <circle className="fill-white/65" cx={STAR_SYSTEM_CENTER.x - 9} cy={STAR_SYSTEM_CENTER.y - 10} r="7" />
    </g>
  )
}

function createStarSystemRendering(starSystem: StarSystem): StarSystemRendering {
  const orbitCount = starSystem.orbits.length
  const rendering: StarSystemRendering = {
    orbitOuterRadii: [],
    sectors: [],
    bodies: [],
    satelliteOrbits: [],
  }

  for (const [orbitIndex, orbit] of starSystem.orbits.entries()) {
    const orbitRadii = getOrbitRadii({ orbitIndex, orbitCount })
    rendering.orbitOuterRadii.push(orbitRadii.outerRadius)

    for (const sector of orbit.sectors) {
      const geometry = getSectorGeometry({
        orbitRadii,
        minAngle: sector.angleRange.min,
        maxAngle: sector.angleRange.max,
      })
      rendering.sectors.push({
        id: sector.id,
        coordinates: sector.coordinates,
        bodyCount: sector.bodies.length,
        path: geometry.path,
      })

      const [centralBody, ...satellites] = sector.bodies
      if (centralBody === undefined) {
        continue
      }

      rendering.bodies.push({ body: centralBody, position: geometry.center })
      if (centralBody.type === "PLANET" && satellites.length > 0) {
        rendering.satelliteOrbits.push({
          sectorId: sector.id,
          center: geometry.center,
          radius: geometry.satelliteOrbitRadius,
        })
      }

      for (const [satelliteIndex, body] of satellites.entries()) {
        rendering.bodies.push({
          body,
          position: getSatellitePosition({
            center: geometry.center,
            satelliteIndex,
            satelliteCount: satellites.length,
            orbitRadius: geometry.satelliteOrbitRadius,
          }),
        })
      }
    }
  }

  return rendering
}

type BodyProps = {
  body: StarSystemBody
  position: Point
}

function Body({ body, position }: BodyProps): ReactElement {
  switch (body.type) {
    case "PLANET":
      return <Planet body={body} position={position} />
    case "MOON":
      return <Moon body={body} position={position} />
    case "ASTEROID":
      return <Asteroid body={body} position={position} />
  }
}

const BODY_CLASS_NAME =
  "cursor-default stroke-white/70 stroke-1 transition-[filter,transform] duration-150 outline-none [transform-box:fill-box] [transform-origin:center] hover:scale-125 hover:[filter:drop-shadow(0_0_9px_rgb(255_255_255/0.9))] focus-visible:scale-125 focus-visible:[filter:drop-shadow(0_0_9px_rgb(255_255_255/0.9))]"

function Planet({ body, position }: BodyProps): ReactElement {
  return (
    <circle
      aria-label={`${body.name}, ${body.coordinates}`}
      className={BODY_CLASS_NAME}
      cx={position.x}
      cy={position.y}
      fill="url(#planet-surface)"
      r="13"
      tabIndex={0}
    >
      <BodyTitle body={body} />
    </circle>
  )
}

function Moon({ body, position }: BodyProps): ReactElement {
  return (
    <circle
      aria-label={`${body.name}, ${body.coordinates}`}
      className={BODY_CLASS_NAME}
      cx={position.x}
      cy={position.y}
      fill="url(#moon-surface)"
      r="7"
      tabIndex={0}
    >
      <BodyTitle body={body} />
    </circle>
  )
}

function Asteroid({ body, position }: BodyProps): ReactElement {
  const points = [
    [position.x, position.y - 9],
    [position.x + 8, position.y - 3],
    [position.x + 6, position.y + 7],
    [position.x - 3, position.y + 9],
    [position.x - 9, position.y + 2],
    [position.x - 6, position.y - 6],
  ]
    .map((point) => point.join(","))
    .join(" ")

  return (
    <polygon aria-label={`${body.name}, ${body.coordinates}`} className={`${BODY_CLASS_NAME} fill-stone-400`} points={points} tabIndex={0}>
      <BodyTitle body={body} />
    </polygon>
  )
}

function BodyTitle({ body }: { body: StarSystemBody }): ReactElement {
  return <title>{`${body.name} · ${body.coordinates}`}</title>
}
