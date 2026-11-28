import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { assert, integer, property, uniqueArray, uuid } from "fast-check"
import { describe, expect, it } from "vitest"
import { PlayerIdSchema } from "#shared/domain/players/PlayerId.ts"
import { createGalaxy } from "#shared/galaxy-creation/createGalaxy.ts"
import { GalaxyCreationSettings } from "#shared/galaxy-creation/GalaxyCreationSettings.ts"
import { createSeededRng } from "#shared/testing/createSeededRng.ts"

const galaxySeed = integer()
const cases = { seed: 762, numRuns: 8 }

describe("createGalaxy", () => {
  it("should leave every planet unowned when the player list is empty (GC-0001)", () => {
    assert(
      property(galaxySeed, (seed) => {
        // Arrange
        const rng = createSeededRng(seed)

        // Act
        const galaxy = createGalaxy({ galaxyCreationSettings: GalaxyCreationSettings, playerIds: [], rng })

        // Assert
        expect(galaxy.systems.every(({ planets }) => planets.every(({ ownerPlayerId }) => ownerPlayerId === null))).toBe(true)
      }),
      cases,
    )
  })

  it("should place each system in a distinct grid cell (GC-SYS-0002)", () => {
    assert(
      property(galaxySeed, (seed) => {
        // Arrange
        const rng = createSeededRng(seed)

        // Act
        const galaxy = createGalaxy({ galaxyCreationSettings: GalaxyCreationSettings, playerIds: [], rng })

        // Assert
        const cells = galaxy.systems.map(({ star }) => `${Math.floor(star.x)},${Math.floor(star.y)}`)
        expect(new Set(cells).size).toBe(cells.length)
      }),
      cases,
    )
  })

  it("should assign exactly one planet to each player and leave the rest unowned (GC-PLNT-0003)", () => {
    const players = uniqueArray(uuid({ version: 4 }), { minLength: 1, maxLength: 8 })
    assert(
      property(galaxySeed, players, (seed, ids) => {
        // Arrange
        const rng = createSeededRng(seed)
        const playerIds = ids.map((id) => typedParse(PlayerIdSchema, id))

        // Act
        const galaxy = createGalaxy({ galaxyCreationSettings: GalaxyCreationSettings, playerIds, rng })

        // Assert
        const owners = galaxy.systems
          .flatMap(({ planets }) => planets.map(({ ownerPlayerId }) => ownerPlayerId))
          .filter((id) => id !== null)
        expect(owners.toSorted()).toStrictEqual(playerIds.toSorted())
      }),
      cases,
    )
  })

  it("should keep systems within the galaxy bounds on both axes (GC-SYS-0004)", () => {
    assert(
      property(galaxySeed, (seed) => {
        // Arrange
        const rng = createSeededRng(seed)
        const diameter = GalaxyCreationSettings.GALAXY_DIAMETER_LIGHT_YEARS

        // Act
        const galaxy = createGalaxy({ galaxyCreationSettings: GalaxyCreationSettings, playerIds: [], rng })

        // Assert
        const axes = galaxy.systems.flatMap(({ star }) => [star.x, star.y])
        expect(Math.min(...axes)).toBeGreaterThanOrEqual(0)
        expect(Math.max(...axes)).toBeLessThan(diameter)
      }),
      cases,
    )
  })
})
