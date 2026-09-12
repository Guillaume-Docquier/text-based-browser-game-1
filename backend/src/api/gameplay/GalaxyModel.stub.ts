import type { GalaxyModel, GalaxySystemModel } from "./GalaxyModel.ts"
import { createStarModelStub } from "./StarModel.stub.ts"

export function createGalaxyModelStub(overrides: Partial<GalaxyModel> = {}): GalaxyModel {
  return { systems: [], ...overrides }
}

export function createGalaxySystemModelStub(overrides: Partial<GalaxySystemModel> = {}): GalaxySystemModel {
  return {
    star: createStarModelStub(),
    planets: [],
    ...overrides,
  }
}
