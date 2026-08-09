import { type Rng, Range } from "@guillaume-docquier/tools-ts"
import type { Point2D } from "#lib/map/points/Point2D.ts"
import { type System, systemGenerator } from "#lib/map/system.generator.ts"

export type Galaxy = {
  /**
   * Width of the galaxy in light years
   */
  width: number
  /**
   * Height of the galaxy in light years
   */
  height: number
  /**
   * Every star system in the galaxy
   */
  systems: System[]
}

type PointsGenerator = (options: { size: number; rng: Rng }) => Point2D[]

/**
 * Creates a square galaxy of the given size in light years.
 * No 2 stars will occupy the same grid cell to allow unique cell based coordinates.
 *
 * We need to know the galaxy size because generators might produces values that will be out of bounds.
 */
export function galaxyGenerator({ size, pointsGenerator, rng }: { size: number; pointsGenerator: PointsGenerator; rng: Rng }): Galaxy {
  const pointsByCell = new Map<string, Point2D>()
  const points = pointsGenerator({ size, rng })
  for (const point of points) {
    // Remove out of bounds
    const bounds = Range.float({ min: 0, max: size })
    if (!Range.isWithin(bounds, point.x) || !Range.isWithin(bounds, point.y)) {
      continue
    }

    // Keep at most 1 point per cell
    pointsByCell.set(`${Math.floor(point.x)}-${Math.floor(point.y)}`, point)
  }

  return {
    width: size,
    height: size,
    // generate systems
    systems: Array.from(pointsByCell.values(), (origin) => systemGenerator(origin, rng)),
  }
}
