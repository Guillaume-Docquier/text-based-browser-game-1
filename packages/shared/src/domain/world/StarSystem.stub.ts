import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { createStarStub } from "#shared/domain/world/stars/Star.stub.ts"
import { StarSystemSchema, type StarSystem } from "#shared/domain/world/StarSystem.ts"

export function createStarSystemStub({ star = createStarStub(), planets = [], ...overrides }: Partial<StarSystem> = {}): StarSystem {
  return typedParse(StarSystemSchema, {
    star,
    planets: [...planets],
    ...overrides,
  })
}
