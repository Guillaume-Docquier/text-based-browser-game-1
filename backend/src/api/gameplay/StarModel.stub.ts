import { branded, type UnbrandedProperties } from "@guillaume-docquier/tools-ts"
import type { StarModel } from "./StarModel.ts"

export function createStarModelStub({ id = 1, ...overrides }: Partial<UnbrandedProperties<StarModel>> = {}): StarModel {
  return {
    id: branded(id),
    name: "star",
    coordinates: "0:0",
    x: 0,
    y: 0,
    ...overrides,
  }
}
