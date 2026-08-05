import type { Rng } from "@guillaume-docquier/tools-ts"
import type { Point2D } from "#lib/map/points/Point2D.ts"

/**
 * 4 stds yields 0.0063% of being outside the desired radius for each axis, so 0.0335% of being outside the disc
 */
const STD_FACTOR = 4

/**
 * Generates a disc of the given radius containing nbPoints that follow a normal distribution around its origin.
 * Some points might fall out of the radius, that's the nature of random numbers following normal distribution.
 */
export function discGenerator({
  origin,
  radius,
  nbPoints,
  rng,
}: {
  origin: Point2D
  radius: number
  nbPoints: number
  rng: Rng
}): Point2D[] {
  const std = radius / STD_FACTOR
  return Array.from({ length: nbPoints }, () => ({
    x: rng.normal(origin.x, std),
    y: rng.normal(origin.y, std),
  }))
}
