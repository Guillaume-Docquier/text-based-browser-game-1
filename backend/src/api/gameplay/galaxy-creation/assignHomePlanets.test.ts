import { branded, mulberry32Prng, Rng } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import { GalaxyCreationSettings } from "#api/gameplay/galaxy-creation/GalaxyCreationSettings.ts"
import { createStarModelStub } from "#api/gameplay/StarModel.stub.ts"
import type { PlanetId } from "#lib/db/planets/PlanetId.ts"
import type { PlayerId } from "#lib/db/players/PlayerId.ts"
import type { StarId } from "#lib/db/stars/StarId.ts"
import { createGalaxyModelStub, createGalaxySystemModelStub } from "../GalaxyModel.stub.ts"
import { createPlanetModelStub } from "../PlanetModel.stub.ts"
import { assignHomePlanets } from "./assignHomePlanets.ts"

describe("assignHomePlanets", () => {
  it("should mutate the galaxy", () => {
    // Arrange
    const firstPlayerId = branded<PlayerId>("first-player")
    const closestPlanetId = branded<PlanetId>(1)
    const galaxy = createGalaxyModelStub({
      systems: [
        createGalaxySystemModelStub({
          star: { id: branded<StarId>(1), name: "closest", coordinates: "50:50", x: 50, y: 50 },
          planets: [createPlanetModelStub({ id: closestPlanetId })],
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

    const galaxy = createGalaxyModelStub({
      systems: [
        createGalaxySystemModelStub({
          star: createStarModelStub({ id: 1, x: 50, y: 50 }),
          planets: [createPlanetModelStub({ id: 11 }), createPlanetModelStub({ id: 22 })],
        }),
        createGalaxySystemModelStub({
          star: createStarModelStub({ id: 2, x: 0, y: 0 }),
          planets: [createPlanetModelStub({ id: 33 })],
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
