import type { Rng, XY } from "@guillaume-docquier/tools-ts"
import { compose, translate, rotate, applyToPoint } from "transformation-matrix"
import { clusterGenerator } from "#shared/galaxy-creation/topology/patterns/clusterGenerator.ts"

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
  origin: XY
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
}): XY[] {
  const points: XY[] = []

  const corePoints = Math.round(rng.normal(nbPoints * corePointsRatio))
  const armPoints = nbPoints - corePoints
  const pointsPerArm = armPoints / armCount

  const coreRadius = rng.normal(radius * coreRadiusRatio)
  points.push(
    ...clusterGenerator({
      origin,
      radius: coreRadius,
      nbPoints: corePoints,
      rng,
    }),
  )

  const angleBetweenArms = (2 * Math.PI) / armCount
  const armAngles = Array.from({ length: armCount }, (_, i) => angleBetweenArms * i)
  for (const armAngle of armAngles) {
    const nbClusters = Math.round(rng.normal(armClusterCount))
    const nbPointsPerCluster = pointsPerArm / nbClusters
    for (let i = 0; i < nbClusters; i++) {
      const distanceFromOrigin = Math.abs(rng.normal(coreRadius, radius * 0.4))

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

  return points.map((point) => {
    const distanceFromOrigin = Math.hypot(point.x - origin.x, point.y - origin.y)
    const swirl = Math.max(0, 1 - distanceFromOrigin / radius) * swirlStrength

    return applyToPoint(compose(translate(origin.x, origin.y), rotate(swirl), translate(-origin.x, -origin.y)), point)
  })
}
