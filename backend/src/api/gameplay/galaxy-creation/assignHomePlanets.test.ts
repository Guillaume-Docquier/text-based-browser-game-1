import { branded, mulberry32Prng, Rng } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import { GalaxyCreationSettings } from "#api/gameplay/galaxy-creation/GalaxyCreationSettings.ts"
import { createStarStub } from "#api/gameplay/Star.stub.ts"
import type { PlayerId } from "#lib/db/players/PlayerId.ts"
import { createGalaxyStub, createSystemStub } from "../Galaxy.stub.ts"
import { createPlanetStub } from "../Planet.stub.ts"
import { assignHomePlanets } from "./assignHomePlanets.ts"

describe("assignHomePlanets", () => {
  it("should mutate the galaxy", () => {
    // Arrange
    const firstPlayerId = branded<PlayerId>("first-player")
    const galaxy = createGalaxyStub({
      systems: [
        createSystemStub({
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
    const firstPlayerId = branded<PlayerId>("first-player")
    const secondPlayerId = branded<PlayerId>("second-player")
    const thirstPlayerId = branded<PlayerId>("third-player")

    const galaxy = createGalaxyStub({
      systems: [
        createSystemStub({
          star: createStarStub({ x: 50, y: 50 }),
          planets: [createPlanetStub(), createPlanetStub()],
        }),
        createSystemStub({
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
