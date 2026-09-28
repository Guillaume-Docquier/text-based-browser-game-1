import { branded, type UnbrandedProperties } from "@guillaume-docquier/tools-ts"
import { v4 } from "uuid"
import type { Star } from "./Star.ts"

/**
 * Provides a unique id if none is specified
 */
export function createStarStub({ id = v4(), ...overrides }: Partial<UnbrandedProperties<Star>> = {}): Star {
  return {
    id: branded(id),
    name: `star-${id}`,
    coordinates: "0:0",
    x: 0,
    y: 0,
    ...overrides,
  }
}
