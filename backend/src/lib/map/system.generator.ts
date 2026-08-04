import type { Planet } from "#lib/map/planet.generator.ts"
import type { Star } from "#lib/map/star.generator.ts"

export type System = {
  star: Star
  planets: Planet[]
}

export function systemGenerator(): System {
  return {
    star: { x: 0, y: 0 },
    planets: [],
  }
}
