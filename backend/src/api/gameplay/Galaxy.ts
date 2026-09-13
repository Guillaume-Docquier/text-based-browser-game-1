import type { Planet } from "./Planet.ts"
import type { Star } from "./Star.ts"

export type System = {
  readonly star: Star
  readonly planets: readonly Planet[]
}

export type Galaxy = {
  readonly systems: readonly System[]
}
