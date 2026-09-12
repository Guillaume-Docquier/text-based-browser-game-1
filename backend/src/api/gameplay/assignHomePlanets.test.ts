import { branded, mulberry32Prng, Rng } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import type { PlanetId } from "#lib/db/planets/PlanetId.ts"
import type { PlayerId } from "#lib/db/players/PlayerId.ts"
import type { StarId } from "#lib/db/stars/StarId.ts"
import { assignHomePlanets } from "./assignHomePlanets.ts"
import { createGalaxyModelStub, createGalaxySystemModelStub } from "./GalaxyModel.stub.ts"
import { createPlanetModelStub } from "./PlanetModel.stub.ts"

describe("assignHomePlanets", () => {
  it("should deterministically shuffle players and use the next closest eligible star", () => {
    // Arrange
    const firstPlayerId = branded<PlayerId>("first-player")
    const secondPlayerId = branded<PlayerId>("second-player")
    const closestPlanetId = branded<PlanetId>(1)
    const fallbackPlanetId = branded<PlanetId>(2)
    const galaxy = createGalaxyModelStub({
      systems: [
        createGalaxySystemModelStub({
          star: { id: branded<StarId>(1), name: "closest", coordinates: "50:50", x: 50, y: 50 },
          planets: [createPlanetModelStub({ id: closestPlanetId })],
        }),
        createGalaxySystemModelStub({
          star: { id: branded<StarId>(2), name: "fallback", coordinates: "0:0", x: 0, y: 0 },
          planets: [createPlanetModelStub({ id: fallbackPlanetId })],
        }),
      ],
    })

    // Act
    const assignedGalaxy = assignHomePlanets({
      galaxy,
      playerIds: [firstPlayerId, secondPlayerId],
      rng: Rng.create(mulberry32Prng(1234)),
    })
    const repeatedAssignedGalaxy = assignHomePlanets({
      galaxy,
      playerIds: [firstPlayerId, secondPlayerId],
      rng: Rng.create(mulberry32Prng(1234)),
    })

    // Assert
    expect(assignedGalaxy).toStrictEqual(repeatedAssignedGalaxy)
    expect(assignedGalaxy.systems[0]?.planets[0]?.ownerPlayerId).toBe(secondPlayerId)
    expect(assignedGalaxy.systems[1]?.planets[0]?.ownerPlayerId).toBe(firstPlayerId)
    expect(galaxy.systems.flatMap(({ planets }) => planets).every(({ ownerPlayerId }) => ownerPlayerId === null)).toBe(true)
  })
})
