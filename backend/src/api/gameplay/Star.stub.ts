import { branded, type UnbrandedProperties } from "@guillaume-docquier/tools-ts"
import type { Star } from "./Star.ts"

export function createStarStub({ id = 1, ...overrides }: Partial<UnbrandedProperties<Star>> = {}): Star {
  return {
    id: branded(id),
    name: "star",
    coordinates: "0:0",
    x: 0,
    y: 0,
    ...overrides,
  }
}
