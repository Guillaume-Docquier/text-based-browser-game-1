import type { Rng } from "@guillaume-docquier/tools-ts"
import type { Point2D } from "#lib/map/points/Point2D.ts"

/**
 * Generates a cluster of the given radius containing nbPoints that follow a normal distribution around its origin.
 * Some points might fall out of the radius, that's the nature of random numbers following normal distribution.
 */
export function clusterGenerator({
  origin,
  radius,
  nbPoints,
  rng,
  options: { spreadFactor = 0.25 } = {},
}: {
  origin: Point2D
  radius: number
  nbPoints: number
  rng: Rng
  options?: {
    /**
     * A higher spread factor will spread the points more
     */
    spreadFactor?: number | undefined
  }
}): Point2D[] {
  const std = radius * spreadFactor
  return Array.from({ length: nbPoints }, () => ({
    x: rng.normal(origin.x, std),
    y: rng.normal(origin.y, std),
  }))
}
