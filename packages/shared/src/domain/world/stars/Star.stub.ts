import type { UnbrandedProperties } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { v4 } from "uuid"
import { StarSchema, type Star } from "#shared/domain/world/stars/Star.ts"

/**
 * Provides a unique id if none is specified
 */
export function createStarStub({ id = v4(), ...overrides }: Partial<UnbrandedProperties<Star>> = {}): Star {
  return typedParse(StarSchema, {
    id,
    name: `star-${id}`,
    coordinates: "0:0",
    x: 0,
    y: 0,
    ...overrides,
  })
}
