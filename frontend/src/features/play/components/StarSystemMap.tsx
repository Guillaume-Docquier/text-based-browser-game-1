import type { StarSystem, StarSystemBody } from "@api-types"
import { type ReactElement } from "react"
import {
  getOrbitRadii,
  getSatellitePosition,
  getSectorGeometry,
  STAR_SYSTEM_CENTER,
  STAR_SYSTEM_VIEW_BOX,
  type Point,
} from "../starSystemGeometry.ts"
import { useStarSystemPanZoom } from "../useStarSystemPanZoom.ts"

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

      <g transform={panZoom.transform}>
        <g aria-label="Sectors">
          {rendering.sectors.map((sector) => (
            <path
              key={sector.id}
              aria-label={`Sector ${sector.coordinates}`}
              className="fill-white/[0.025] stroke-white/10 stroke-[1.25] transition-[fill,stroke,filter] duration-150 outline-none hover:fill-primary/20 hover:stroke-primary hover:[filter:drop-shadow(0_0_10px_rgb(251_191_36/0.7))] focus-visible:fill-primary/20 focus-visible:stroke-primary focus-visible:[filter:drop-shadow(0_0_10px_rgb(251_191_36/0.7))]"
              d={sector.path}
              tabIndex={0}
            >
              <title>{`Sector ${sector.coordinates} · ${sector.bodyCount} ${sector.bodyCount === 1 ? "body" : "bodies"}`}</title>
            </path>
          ))}
        </g>

        <g aria-hidden="true" className="pointer-events-none fill-none stroke-primary/25 stroke-2">
          {rendering.orbitOuterRadii.map((outerRadius) => (
            <circle key={outerRadius} cx={STAR_SYSTEM_CENTER.x} cy={STAR_SYSTEM_CENTER.y} r={outerRadius} />
          ))}
        </g>

        <g aria-label="Bodies">
          {rendering.satelliteOrbits.map((satelliteOrbit) => (
            <circle
              key={satelliteOrbit.sectorId}
              aria-hidden="true"
              className="pointer-events-none fill-none stroke-white/15"
              cx={satelliteOrbit.center.x}
              cy={satelliteOrbit.center.y}
              r={satelliteOrbit.radius}
            />
          ))}
          {rendering.bodies.map(({ body, position }) => (
            <BodyMarker key={body.id} body={body} position={position} />
          ))}
        </g>

        <g aria-label="Star" className="pointer-events-none">
          <circle className="fill-amber-500/15" cx={STAR_SYSTEM_CENTER.x} cy={STAR_SYSTEM_CENTER.y} filter="url(#star-glow)" r="55" />
          <circle cx={STAR_SYSTEM_CENTER.x} cy={STAR_SYSTEM_CENTER.y} fill="url(#star-core)" r="31" />
          <circle className="fill-white/65" cx={STAR_SYSTEM_CENTER.x - 9} cy={STAR_SYSTEM_CENTER.y - 10} r="7" />
        </g>
      </g>
    </svg>
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

function BodyMarker({ body, position }: { body: StarSystemBody; position: Point }): ReactElement {
  const commonProps = {
    "aria-label": `${body.name}, ${body.coordinates}`,
    className:
      "cursor-default stroke-white/70 stroke-1 transition-[filter,transform] duration-150 outline-none [transform-box:fill-box] [transform-origin:center] hover:scale-125 hover:[filter:drop-shadow(0_0_9px_rgb(255_255_255/0.9))] focus-visible:scale-125 focus-visible:[filter:drop-shadow(0_0_9px_rgb(255_255_255/0.9))]",
    tabIndex: 0,
  } as const

  if (body.type === "PLANET") {
    return (
      <circle {...commonProps} cx={position.x} cy={position.y} fill="url(#planet-surface)" r="13">
        <title>{`${body.name} · ${body.coordinates}`}</title>
      </circle>
    )
  }

  if (body.type === "MOON") {
    return (
      <circle {...commonProps} cx={position.x} cy={position.y} fill="url(#moon-surface)" r="7">
        <title>{`${body.name} · ${body.coordinates}`}</title>
      </circle>
    )
  }

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
    <polygon {...commonProps} className={`${commonProps.className} fill-stone-400`} points={points}>
      <title>{`${body.name} · ${body.coordinates}`}</title>
    </polygon>
  )
}
