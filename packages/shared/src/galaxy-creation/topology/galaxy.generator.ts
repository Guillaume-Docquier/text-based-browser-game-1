import { type Rng, Range, type XY } from "@guillaume-docquier/tools-ts"
import { type GeneratedSystem, systemGenerator } from "#shared/galaxy-creation/topology/system.generator.ts"

export type GeneratedGalaxy = {
  width: number
  height: number
  systems: GeneratedSystem[]
}

type PointsGenerator = (options: { size: number; rng: Rng }) => XY[]

export function galaxyGenerator({
  size,
  pointsGenerator,
  rng,
}: {
  size: number
  pointsGenerator: PointsGenerator
  rng: Rng
}): GeneratedGalaxy {
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
    systems: Array.from(pointsByCell.values(), (origin) => systemGenerator(origin, rng)),
  }
}
