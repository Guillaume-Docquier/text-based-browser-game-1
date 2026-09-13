import type { Galaxy, System } from "./Galaxy.ts"
import { createStarStub } from "./Star.stub.ts"

export function createGalaxyStub(overrides: Partial<Galaxy> = {}): Galaxy {
  return { systems: [], ...overrides }
}

export function createSystemStub(overrides: Partial<System> = {}): System {
  return {
    star: createStarStub(),
    planets: [],
    ...overrides,
  }
}
