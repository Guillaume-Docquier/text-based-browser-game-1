import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { GalaxySchema, type Galaxy } from "#shared/domain/world/Galaxy.ts"

export function createGalaxyStub({ systems = [], ...overrides }: Partial<Galaxy> = {}): Galaxy {
  return typedParse(GalaxySchema, {
    // kinda annoying, this is because of readonly modifiers
    systems: systems.map(({ star, planets }) => ({ star, planets: [...planets] })),
    ...overrides,
  })
}
