import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { GalaxySchema, type Galaxy } from "#shared/domain/world/Galaxy.ts"

export function createGalaxyStub(overrides: Partial<Galaxy> = {}): Galaxy {
  const systems =
    overrides.systems?.map(({ star, planets }) => ({
      star,
      planets: [...planets],
    })) ?? []

  return typedParse(GalaxySchema, { systems })
}
