import type { Point2D } from "#lib/map/points/Point.ts"
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

type PointsGenerator = (options: { size: number }) => Point2D[]

/**
 * Creates a square galaxy of the given size in light years.
 * All stars will be grid aligned.
 * No stars will occupy the same grid cell, meaning the minimum distance between any 2 stars is 1 light year.
 *
 * We need to know the galaxy size because generators might produces values that will be out of bounds.
 */
export function galaxyGenerator({ size, pointsGenerator }: { size: number; pointsGenerator: PointsGenerator }): Galaxy {
  const uniquePoints = new Map<string, Point2D>()
  const points = pointsGenerator({ size })
  for (const point of points) {
    // Grid align
    point.x = Math.round(point.x)
    point.y = Math.round(point.y)

    // Remove out of bounds
    if (point.x < 0 || point.y >= size) {
      continue
    }

    // Remove duplicates
    uniquePoints.set(`${point.x.toFixed(0)}-${point.y.toFixed(0)}`, point)
  }

  return {
    width: size,
    height: size,
    // generate systems
    systems: Array.from(uniquePoints.values(), systemGenerator),
  }
}
