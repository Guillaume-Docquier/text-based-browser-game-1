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
  it("GC-0001 When the player list is empty, every planet in the returned galaxy is unowned.", () => {
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

  it("GC-SYS-0002 Each system in the returned galaxy occupies a distinct one-light-year grid cell.", () => {
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

  it("GC-PLNT-0003 When there are enough planets for the supplied players, each player owns exactly one planet and all remaining planets are unowned.", () => {
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

  it("GC-SYS-0004 Each system has x and y coordinates greater than or equal to zero and less than the configured galaxy diameter.", () => {
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
