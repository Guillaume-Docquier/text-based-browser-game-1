import type { Rng } from "@guillaume-docquier/tools-ts"
import type { Point2D } from "#lib/map/points/Point2D.ts"

export type Star = {
  x: number
  y: number
}

export function starGenerator(origin: Point2D, _: Rng): Star {
  return origin
}
