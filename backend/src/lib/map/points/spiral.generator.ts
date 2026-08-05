import type { Rng } from "@guillaume-docquier/tools-ts"
import { compose, translate, rotate, applyToPoint } from "transformation-matrix"
import { discGenerator } from "#lib/map/points/disc.generator.ts"
import type { Point2D } from "#lib/map/points/Point.ts"

const CORE_POINTS_RATIO = 0.2
const CORE_RADIUS_RATIO = 0.15
const DISKS_PER_ARM = 8

// PRIMER ON PROCEDURAL GENERATION BECAUSE I WILL FORGET
//
// The main concept is: take something structured, then throw a bunch of gaussian (normal) noise at it, and now it looks random
// Every value used to determine any setting (nb arms, arm size, radius, angle, etc) gets some noise
// mean controls the expected value
// std controls the noise (higher == more noise)
// spread radius / 4 gives you a decent spread with very few values outside the range

/**
 * Generates a spiral of the given radius with nbArms containing nbPoints that follow a normal distribution around its origin.
 * Some points might fall out of the radius, that's the nature of random numbers following normal distribution.
 */
export function spiralGenerator({
  origin,
  radius,
  nbPoints,
  arms,
  rng,
}: {
  origin: Point2D
  radius: number
  nbPoints: number
  arms: { count: number; size: number }
  rng: Rng
}): Point2D[] {
  const points: Point2D[] = []

  // roughly
  const corePoints = Math.round(rng.normal(nbPoints * CORE_POINTS_RATIO))
  const armPoints = nbPoints - corePoints
  const pointsPerArm = armPoints / arms.count

  // core
  const coreRadius = Math.round(rng.normal(radius * CORE_RADIUS_RATIO))
  points.push(
    ...discGenerator({
      origin,
      radius: coreRadius,
      nbPoints: corePoints,
      rng,
    }),
  )

  // Arms
  const angleBetweenArms = (2 * Math.PI) / arms.count
  const armAngles = Array.from({ length: arms.count }, (_, i) => angleBetweenArms * i)
  for (const armAngle of armAngles) {
    // Each arm is a series of discs
    const nbDiscs = Math.round(rng.normal(DISKS_PER_ARM))
    const nbPointsPerDisc = pointsPerArm / nbDiscs
    for (let i = 0; i < nbDiscs; i++) {
      const distanceFromOrigin = Math.abs(rng.normal(coreRadius, radius * 0.4))

      // Extend out and rotate around the center
      const discCenter = applyToPoint(compose(translate(origin.x, origin.y), rotate(armAngle), translate(distanceFromOrigin, 0)), {
        x: 0,
        y: 0,
      })

      points.push(
        ...discGenerator({
          origin: discCenter,
          radius: Math.round(rng.normal(arms.size)),
          nbPoints: Math.round(rng.normal(nbPointsPerDisc)),
          rng,
        }),
      )
    }
  }

  // Add the final swirl, stronger the closer you are to the center
  return points.map((point) => {
    const distanceFromOrigin = Math.hypot(point.x - origin.x, point.y - origin.y)
    const swirl = Math.max(0, 1 - distanceFromOrigin / radius)

    return applyToPoint(compose(translate(origin.x, origin.y), rotate(swirl), translate(-origin.x, -origin.y)), point)
  })
}
