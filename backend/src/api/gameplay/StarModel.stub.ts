import { branded } from "@guillaume-docquier/tools-ts"
import type { StarId } from "#lib/db/stars/StarId.ts"
import type { StarModel } from "./StarModel.ts"

export function createStarModelStub(overrides: Partial<StarModel> = {}): StarModel {
  return {
    id: branded<StarId>(1),
    name: "star",
    coordinates: "0:0",
    x: 0,
    y: 0,
    ...overrides,
  }
}
