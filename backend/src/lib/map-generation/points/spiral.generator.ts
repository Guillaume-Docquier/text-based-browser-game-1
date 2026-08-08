import type { Rng } from "@guillaume-docquier/tools-ts"
import { compose, translate, rotate, applyToPoint } from "transformation-matrix"
import { clusterGenerator } from "#lib/map-generation/points/cluster.generator.ts"
import type { Point2D } from "#lib/map-generation/points/Point2D.ts"

// PRIMER ON PROCEDURAL GENERATION BECAUSE I WILL FORGET
//
// The main concept is: take something structured, then throw a bunch of gaussian (normal) noise at it, and now it looks random
// Every value used to determine any setting (nb arms, arm size, radius, angle, etc) gets some noise
// mean controls the expected value
// std controls the noise (higher == more noise)
// and std of `spread radius / 4` gives you a decent spread with very few values outside the range

/**
 * Generates a spiral of the given radius with nbArms containing nbPoints that follow a normal distribution around its origin.
 * Some points might fall out of the radius, that's the nature of random numbers following normal distribution.
 */
export function spiralGenerator({
  origin,
  radius,
  nbPoints,
  rng,
  options: {
    corePointsRatio = 0.2,
    coreRadiusRatio = 0.15,
    armCount = 6,
    armRadius = 12,
    armClusterCount = 16,
    swirlStrength = Math.PI,
  } = {},
}: {
  origin: Point2D
  radius: number
  nbPoints: number
  rng: Rng
  options?: {
    corePointsRatio?: number | undefined
    coreRadiusRatio?: number | undefined
    armCount?: number | undefined
    armRadius?: number | undefined
    armClusterCount?: number | undefined
    swirlStrength?: number | undefined
  }
}): Point2D[] {
  const points: Point2D[] = []

  // roughly, because of rng we might have a little more or a little less stars in the arms because the arms will generate clusters with varying amounts of stars
  const corePoints = Math.round(rng.normal(nbPoints * corePointsRatio))
  const armPoints = nbPoints - corePoints
  const pointsPerArm = armPoints / armCount

  // core
  const coreRadius = rng.normal(radius * coreRadiusRatio)
  points.push(
    ...clusterGenerator({
      origin,
      radius: coreRadius,
      nbPoints: corePoints,
      rng,
    }),
  )

  // Arms
  const angleBetweenArms = (2 * Math.PI) / armCount
  const armAngles = Array.from({ length: armCount }, (_, i) => angleBetweenArms * i)
  for (const armAngle of armAngles) {
    // Each arm is a series of clusters
    const nbClusters = Math.round(rng.normal(armClusterCount))
    const nbPointsPerCluster = pointsPerArm / nbClusters
    for (let i = 0; i < nbClusters; i++) {
      const distanceFromOrigin = Math.abs(rng.normal(coreRadius, radius * 0.4))

      // Extend out and rotate around the center
      const clusterCenter = applyToPoint(compose(translate(origin.x, origin.y), rotate(armAngle), translate(distanceFromOrigin, 0)), {
        x: 0,
        y: 0,
      })

      points.push(
        ...clusterGenerator({
          origin: clusterCenter,
          radius: rng.normal(armRadius, armRadius * 0.5),
          nbPoints: Math.round(rng.normal(nbPointsPerCluster)),
          rng,
        }),
      )
    }
  }

  // Add the final swirl, stronger the closer you are to the center
  return points.map((point) => {
    const distanceFromOrigin = Math.hypot(point.x - origin.x, point.y - origin.y)
    const swirl = Math.max(0, 1 - distanceFromOrigin / radius) * swirlStrength

    return applyToPoint(compose(translate(origin.x, origin.y), rotate(swirl), translate(-origin.x, -origin.y)), point)
  })
}
