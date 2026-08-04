import type { System } from "#lib/map/system.generator.ts"

export type Galaxy = {
  /**
   * Width of the galaxy in light years
   */
  width: number
  /**
   * Height of the galaxy in light years
   */
  height: number
  /**
   * Every star system in the galaxy
   */
  systems: System[]
}

export function galaxyGenerator(): Galaxy {
  return {
    width: 0,
    height: 0,
    systems: [],
  }
}
