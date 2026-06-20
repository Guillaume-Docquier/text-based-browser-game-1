export type Point = {
  x: number
  y: number
}

export type OrbitRadii = {
  innerRadius: number
  outerRadius: number
}

export type SectorGeometry = OrbitRadii & {
  center: Point
  path: string
  satelliteOrbitRadius: number
}

const CENTER = 500
// Reserve a clear area for the star so the innermost bodies do not compete with its glow.
const INNER_SYSTEM_RADIUS = 72
// Leave room inside the view box for glow and hover effects instead of clipping them at the SVG edge.
const OUTER_SYSTEM_RADIUS = 458

export const STAR_SYSTEM_VIEW_BOX = "0 0 1000 1000"
export const STAR_SYSTEM_CENTER: Point = { x: CENTER, y: CENTER }

export function getOrbitRadii({ orbitIndex, orbitCount }: { orbitIndex: number; orbitCount: number }): OrbitRadii {
  // Equal visual widths keep outer Orbits readable instead of allowing their larger circumference to dominate the map.
  const orbitWidth = (OUTER_SYSTEM_RADIUS - INNER_SYSTEM_RADIUS) / orbitCount

  return {
    innerRadius: INNER_SYSTEM_RADIUS + orbitIndex * orbitWidth,
    outerRadius: INNER_SYSTEM_RADIUS + (orbitIndex + 1) * orbitWidth,
  }
}

export function getSectorGeometry({
  orbitRadii,
  minAngle,
  maxAngle,
}: {
  orbitRadii: OrbitRadii
  minAngle: number
  maxAngle: number
}): SectorGeometry {
  const { innerRadius, outerRadius } = orbitRadii
  const middleRadius = (innerRadius + outerRadius) / 2
  const middleAngle = (minAngle + maxAngle) / 2
  // Cap the half-angle because sectors wider than a semicircle have the same limiting chord at 90 degrees.
  const halfAngleRadians = degreesToRadians(Math.min((maxAngle - minAngle) / 2, 90))
  const availableTangentialRadius = middleRadius * Math.sin(halfAngleRadians)
  const availableRadialRadius = (outerRadius - innerRadius) / 2

  return {
    innerRadius,
    outerRadius,
    center: polarPoint(middleAngle, middleRadius),
    path: annularSectorPath({ innerRadius, outerRadius, minAngle, maxAngle }),
    // Fit satellites inside both the Orbit band and the Sector wedge, with a cap that prevents sparse sectors from looking oversized.
    satelliteOrbitRadius: Math.min(32, availableRadialRadius * 0.58, availableTangentialRadius * 0.55),
  }
}

export function getSatellitePosition({
  center,
  satelliteIndex,
  satelliteCount,
  orbitRadius,
}: {
  center: Point
  satelliteIndex: number
  satelliteCount: number
  orbitRadius: number
}): Point {
  // Even spacing keeps arbitrary Body counts deterministic without assigning gameplay meaning to visual placement.
  const angle = (360 / satelliteCount) * satelliteIndex
  const offset = polarPoint(angle, orbitRadius, { x: 0, y: 0 })

  return {
    x: center.x + offset.x,
    y: center.y + offset.y,
  }
}

function annularSectorPath({ innerRadius, outerRadius, minAngle, maxAngle }: OrbitRadii & { minAngle: number; maxAngle: number }): string {
  const angleSpan = maxAngle - minAngle

  if (angleSpan >= 360) {
    // SVG arc commands cannot express a complete circle with one arc, so a full-Orbit Sector needs a dedicated path.
    return fullAnnulusPath(innerRadius, outerRadius)
  }

  const outerStart = polarPoint(minAngle, outerRadius)
  const outerEnd = polarPoint(maxAngle, outerRadius)
  const innerEnd = polarPoint(maxAngle, innerRadius)
  const innerStart = polarPoint(minAngle, innerRadius)
  const largeArcFlag = angleSpan > 180 ? 1 : 0

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${innerStart.x} ${innerStart.y}`,
    "Z",
  ].join(" ")
}

function fullAnnulusPath(innerRadius: number, outerRadius: number): string {
  return [
    `M ${CENTER} ${CENTER - outerRadius}`,
    `A ${outerRadius} ${outerRadius} 0 1 1 ${CENTER} ${CENTER + outerRadius}`,
    `A ${outerRadius} ${outerRadius} 0 1 1 ${CENTER} ${CENTER - outerRadius}`,
    `M ${CENTER} ${CENTER - innerRadius}`,
    `A ${innerRadius} ${innerRadius} 0 1 0 ${CENTER} ${CENTER + innerRadius}`,
    `A ${innerRadius} ${innerRadius} 0 1 0 ${CENTER} ${CENTER - innerRadius}`,
    "Z",
  ].join(" ")
}

function polarPoint(angle: number, radius: number, center: Point = STAR_SYSTEM_CENTER): Point {
  const angleRadians = degreesToRadians(angle)

  return {
    // Match the backend convention: zero degrees is 12 o'clock and angles increase clockwise.
    x: center.x + radius * Math.sin(angleRadians),
    y: center.y - radius * Math.cos(angleRadians),
  }
}

function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}
