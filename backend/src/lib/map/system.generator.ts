import type { Planet } from "#lib/map/planet.generator.ts"
import type { Point2D } from "#lib/map/points/Point2D.ts"
import { type Star, starGenerator } from "#lib/map/star.generator.ts"

export type System = {
  star: Star
  planets: Planet[]
}

export function systemGenerator(origin: Point2D): System {
  return {
    star: starGenerator(origin),
    planets: [],
  }
}
