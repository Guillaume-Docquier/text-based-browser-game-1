import { mulberry32Prng, Rng } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { v4 } from "uuid"
import { describe, expect, it } from "vitest"
import { PlayerIdSchema } from "#shared/domain/players/PlayerId.ts"
import { createGalaxyStub } from "#shared/domain/world/Galaxy.stub.ts"
import { createPlanetStub } from "#shared/domain/world/planets/Planet.stub.ts"
import { createStarStub } from "#shared/domain/world/stars/Star.stub.ts"
import { createStarSystemStub } from "#shared/domain/world/StarSystem.stub.ts"
import { assignHomePlanets } from "#shared/galaxy-creation/assignHomePlanets.ts"
import { GalaxyCreationSettings } from "#shared/galaxy-creation/GalaxyCreationSettings.ts"

describe("assignHomePlanets", () => {
  it("should mutate the galaxy", () => {
    // Arrange
    const firstPlayerId = typedParse(PlayerIdSchema, v4())
    const galaxy = createGalaxyStub({
      systems: [
        createStarSystemStub({
          star: createStarStub(),
          planets: [createPlanetStub()],
        }),
      ],
    })

    // Act
    const assignedGalaxy = assignHomePlanets({
      galaxyCreationSettings: GalaxyCreationSettings,
      galaxy,
      playerIds: [firstPlayerId],
      rng: Rng.create(mulberry32Prng(1234)),
    })

    // Assert
    expect(assignedGalaxy).toBe(galaxy)
  })

  it("should deterministically assign unclaimed planets", () => {
    // Arrange
    const firstPlayerId = typedParse(PlayerIdSchema, "00000000-0000-4000-8000-000000000001")
    const secondPlayerId = typedParse(PlayerIdSchema, "00000000-0000-4000-8000-000000000002")
    const thirstPlayerId = typedParse(PlayerIdSchema, "00000000-0000-4000-8000-000000000003")

    const galaxy = createGalaxyStub({
      systems: [
        createStarSystemStub({
          star: createStarStub({ x: 50, y: 50 }),
          planets: [createPlanetStub(), createPlanetStub()],
        }),
        createStarSystemStub({
          star: createStarStub({ x: 0, y: 0 }),
          planets: [createPlanetStub()],
        }),
      ],
    })

    // Act
    const assignedGalaxy = assignHomePlanets({
      galaxyCreationSettings: GalaxyCreationSettings,
      galaxy,
      playerIds: [firstPlayerId, secondPlayerId, thirstPlayerId],
      rng: Rng.create(mulberry32Prng(1234)),
    })

    // Assert
    expect(assignedGalaxy.systems[0]?.planets[0]?.ownerPlayerId).toBe(secondPlayerId)
    expect(assignedGalaxy.systems[0]?.planets[1]?.ownerPlayerId).toBe(thirstPlayerId)
    expect(assignedGalaxy.systems[1]?.planets[0]?.ownerPlayerId).toBe(firstPlayerId)
  })
})
