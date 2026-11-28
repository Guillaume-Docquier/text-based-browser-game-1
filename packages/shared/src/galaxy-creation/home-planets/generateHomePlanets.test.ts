import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { describe, expect, it } from "vitest"
import { PlayerIdSchema } from "#shared/domain/players/PlayerId.ts"
import { createGalaxyStub } from "#shared/domain/world/Galaxy.stub.ts"
import { createPlanetStub } from "#shared/domain/world/planets/Planet.stub.ts"
import { SUN_ID } from "#shared/domain/world/Sol.ts"
import { createStarStub } from "#shared/domain/world/stars/Star.stub.ts"
import { createStarSystemStub } from "#shared/domain/world/StarSystem.stub.ts"
import { GalaxyCreationSettings } from "#shared/galaxy-creation/GalaxyCreationSettings.ts"
import { generateHomePlanets } from "#shared/galaxy-creation/home-planets/generateHomePlanets.ts"
import { createSeededRng } from "#shared/testing/createSeededRng.ts"

describe("generateHomePlanets", () => {
  it("should assign the area-three planet when the nearest system has only small or owned planets", () => {
    // Arrange
    const playerId = typedParse(PlayerIdSchema, "00000000-0000-4000-8000-000000000001")
    const ownerPlayerId = typedParse(PlayerIdSchema, "00000000-0000-4000-8000-000000000002")
    const galaxy = createGalaxyStub({
      systems: [
        createStarSystemStub({
          star: createStarStub({ x: 62, y: 50 }),
          planets: [createPlanetStub({ area: 2 }), createPlanetStub({ area: 4, ownerPlayerId })],
        }),
        createStarSystemStub({
          star: createStarStub({ x: 70, y: 50 }),
          planets: [createPlanetStub({ area: 2 }), createPlanetStub({ area: 3 })],
        }),
      ],
    })

    // Act
    const assigned = generateHomePlanets({
      galaxyCreationSettings: GalaxyCreationSettings,
      sun: { x: 50, y: 50 },
      galaxy,
      playerIds: [playerId],
      rng: createSeededRng(),
    })

    // Assert
    expect(assigned).toBe(galaxy)
    expect(assigned.systems.map(({ planets }) => planets.map((planet) => planet.ownerPlayerId))).toStrictEqual([
      [null, ownerPlayerId],
      [null, playerId],
    ])
  })

  it("should fail before assigning any planet when two players have only one eligible system", () => {
    // Arrange
    const playerIds = ["00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000002"].map((id) =>
      typedParse(PlayerIdSchema, id),
    )
    const galaxy = createGalaxyStub({
      systems: [createStarSystemStub({ planets: [createPlanetStub({ area: 3 }), createPlanetStub({ area: 5 })] })],
    })

    // Act & Assert
    expect(() =>
      generateHomePlanets({
        galaxyCreationSettings: GalaxyCreationSettings,
        sun: { x: 50, y: 50 },
        galaxy,
        playerIds,
        rng: createSeededRng(),
      }),
    ).toThrow("Expected condition to be true.")
    expect(galaxy.systems[0]?.planets.map(({ ownerPlayerId }) => ownerPlayerId)).toStrictEqual([null, null])
  })

  it("should keep Sol neutral even if it is the closest system with an eligible planet", () => {
    // Arrange
    const playerId = typedParse(PlayerIdSchema, "00000000-0000-4000-8000-000000000001")
    const sol = createStarSystemStub({ star: createStarStub({ id: SUN_ID, x: 50, y: 50 }), planets: [createPlanetStub({ area: 3 })] })
    const distant = createStarSystemStub({ star: createStarStub({ x: 90, y: 90 }), planets: [createPlanetStub({ area: 3 })] })
    const galaxy = createGalaxyStub({ systems: [sol, distant] })

    // Act
    const assigned = generateHomePlanets({
      galaxy,
      sun: sol.star,
      galaxyCreationSettings: GalaxyCreationSettings,
      playerIds: [playerId],
      rng: createSeededRng(),
    })

    // Assert
    expect(assigned.systems.map(({ planets }) => planets[0]?.ownerPlayerId)).toStrictEqual([null, playerId])
  })
})
