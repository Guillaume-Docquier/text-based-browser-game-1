import { type Rng, Range, type XY } from "@guillaume-docquier/tools-ts"
import { type SystemTopology, systemTopologyGenerator } from "#shared/galaxy-creation/topology/systemTopologyGenerator.ts"

export type GalaxyTopology = {
  width: number
  height: number
  systems: SystemTopology[]
}

type PointsGenerator = (options: { size: number; rng: Rng }) => XY[]

export function galaxyTopologyGenerator({
  size,
  pointsGenerator,
  rng,
}: {
  size: number
  pointsGenerator: PointsGenerator
  rng: Rng
}): GalaxyTopology {
  const pointsByCell = new Map<string, XY>()
  const points = pointsGenerator({ size, rng })
  for (const point of points) {
    const bounds = Range.float({ min: 0, max: size })
    if (!Range.isWithin(bounds, point.x) || !Range.isWithin(bounds, point.y)) {
      continue
    }

    pointsByCell.set(`${Math.floor(point.x)}-${Math.floor(point.y)}`, point)
  }

  return {
    width: size,
    height: size,
    systems: Array.from(pointsByCell.values(), (origin) => systemTopologyGenerator(origin, rng)),
  }
}
