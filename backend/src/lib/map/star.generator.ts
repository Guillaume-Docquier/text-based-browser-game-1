import type { Point2D } from "#lib/map/points/Point2D.ts"

export type Star = {
  x: number
  y: number
}

export function starGenerator(origin: Point2D): Star {
  return origin
}
